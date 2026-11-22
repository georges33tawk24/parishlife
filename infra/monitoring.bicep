// Purpose: alerting, uptime checks and a cost budget for the existing ParishLife resources (hardening items 5, 6, 9 and 10).
// It creates monitoring resources only; it never changes the app, its data, its settings or its network.
// Main parts: one email action group; metric alerts (downtime, 5xx answers, slow answers, CPU, memory, Cosmos throttling); two log search
// alerts (security events from ParishLife.Security, background work that keeps failing); two availability tests from three European
// regions; a monthly budget with 50/80/100 % actual and 100 % forecast emails.
// Deploy (owner, after az login; preview first):
//   az deployment group what-if -g rg-parishlife -f infra/monitoring.bicep -p alertEmail=<your address> monthlyBudget=<amount>
//   az deployment group create  -g rg-parishlife -f infra/monitoring.bicep -p alertEmail=<your address> monthlyBudget=<amount>
// Runbook, thresholds and costs: docs/operations/monitoring-and-alerts.md. Not compiled on the authoring machine (no Bicep CLI there):
// what-if is the first check.

@description('Where alerts and budget warnings are emailed.')
param alertEmail string

@description('Monthly budget for the resource group, in the billing currency. Warnings at 50, 80 and 100 % of actual and 100 % of forecast.')
param monthlyBudget int

@description('First day of the month the budget starts counting (yyyy-MM-01).')
param budgetStartDate string = utcNow('yyyy-MM-01')

@description('Public address checked by the availability tests.')
param publicUrl string = 'https://parish-life.org'

@description('Classic URL ping tests are free (retiring 30 September 2028); set false to create paid standard tests instead.')
param useFreePingTests bool = true

param appInsightsName string = 'insights-parishlife'
param webAppName string = 'app-parishlife'
param planName string = 'plan-parishlife'
param cosmosAccountName string = 'cosmos-parishlife'

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
}

resource webApp 'Microsoft.Web/sites@2023-12-01' existing = {
  name: webAppName
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' existing = {
  name: planName
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-parishlife-owner'
  location: 'global'
  properties: {
    groupShortName: 'parishlife'
    enabled: true
    emailReceivers: [
      {
        name: 'owner-email'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// France Central, West Europe, North Europe.
var testLocations = [
  { Id: 'emea-fr-pra-edge' }
  { Id: 'emea-nl-ams-azr' }
  { Id: 'emea-gb-db3-azr' }
]

// The readiness probe covers the API and its dependencies (Cosmos, Blob, Key Vault metadata); the sign-in page covers the static frontend.
var availabilityTests = [
  { name: 'parishlife-ready', title: 'ParishLife API readiness', path: '/health/ready' }
  { name: 'parishlife-signin-page', title: 'ParishLife sign-in page', path: '/' }
]

resource webTests 'Microsoft.Insights/webtests@2022-06-15' = [for test in availabilityTests: {
  name: test.name
  location: appInsights.location
  tags: {
    'hidden-link:${appInsights.id}': 'Resource'
  }
  kind: useFreePingTests ? 'ping' : 'standard'
  properties: union({
    SyntheticMonitorId: test.name
    Name: test.title
    Enabled: true
    Frequency: 300
    Timeout: 30
    RetryEnabled: true
    Locations: testLocations
  }, useFreePingTests ? {
    Kind: 'ping'
    Configuration: {
      WebTest: '<WebTest Name="${test.name}" Enabled="True" Timeout="30" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010"><Items><Request Method="GET" Guid="${guid(test.name)}" Version="1.1" Url="${publicUrl}${test.path}" ThinkTime="0" Timeout="30" ParseDependentRequests="False" FollowRedirects="True" RecordResult="True" Cache="False" ResponseTimeGoal="0" Encoding="utf-8" ExpectedHttpStatusCode="200" IgnoreHttpStatusCode="False" /></Items></WebTest>'
    }
  } : {
    Kind: 'standard'
    Request: {
      RequestUrl: '${publicUrl}${test.path}'
      HttpVerb: 'GET'
      ParseDependentRequests: false
    }
    ValidationRules: {
      ExpectedHttpStatusCode: 200
      SSLCheck: true
      SSLCertRemainingLifetimeCheck: 14
    }
  })
}]

resource availabilityAlerts 'Microsoft.Insights/metricAlerts@2018-03-01' = [for (test, i) in availabilityTests: {
  name: '${test.name}-down'
  location: 'global'
  properties: {
    description: '${test.title} failed from at least 2 of 3 regions.'
    severity: 1
    enabled: true
    scopes: [
      webTests[i].id
      appInsights.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: webTests[i].id
      componentId: appInsights.id
      failedLocationCount: 2
    }
    actions: [
      { actionGroupId: actionGroup.id }
    ]
  }
}]

// Single-resource metric alerts. The first 10 monitored time series a month are free; these are 5 of them plus the 2 above.
var metricAlerts = [
  {
    name: 'parishlife-health-check'
    description: 'App Service health check on /health/ready is failing (it probes every minute from inside Azure).'
    severity: 1
    scope: webApp.id
    namespace: 'Microsoft.Web/sites'
    metric: 'HealthCheckStatus'
    operator: 'LessThan'
    threshold: 100
    aggregation: 'Average'
    window: 'PT5M'
    dimensions: []
  }
  {
    name: 'parishlife-server-errors'
    description: 'More than 3 server errors (HTTP 5xx) in 15 minutes.'
    severity: 2
    scope: webApp.id
    namespace: 'Microsoft.Web/sites'
    metric: 'Http5xx'
    operator: 'GreaterThan'
    threshold: 3
    aggregation: 'Total'
    window: 'PT15M'
    dimensions: []
  }
  {
    name: 'parishlife-slow-responses'
    description: 'Average response time above 1.5 seconds for 15 minutes (pilot staff target p95 < 1.5 s, hardening report 04).'
    severity: 3
    scope: webApp.id
    namespace: 'Microsoft.Web/sites'
    metric: 'HttpResponseTime'
    operator: 'GreaterThan'
    threshold: json('1.5')
    aggregation: 'Average'
    window: 'PT15M'
    dimensions: []
  }
  {
    name: 'parishlife-plan-cpu'
    description: 'App Service plan CPU above 85 % for 15 minutes.'
    severity: 3
    scope: plan.id
    namespace: 'Microsoft.Web/serverfarms'
    metric: 'CpuPercentage'
    operator: 'GreaterThan'
    threshold: 85
    aggregation: 'Average'
    window: 'PT15M'
    dimensions: []
  }
  {
    name: 'parishlife-plan-memory'
    description: 'App Service plan memory above 85 % for 15 minutes.'
    severity: 3
    scope: plan.id
    namespace: 'Microsoft.Web/serverfarms'
    metric: 'MemoryPercentage'
    operator: 'GreaterThan'
    threshold: 85
    aggregation: 'Average'
    window: 'PT15M'
    dimensions: []
  }
  {
    name: 'parishlife-cosmos-throttled'
    description: 'Cosmos DB refused more than 10 requests with 429 (throttled) in 15 minutes.'
    severity: 3
    scope: cosmos.id
    namespace: 'Microsoft.DocumentDB/databaseAccounts'
    metric: 'TotalRequests'
    operator: 'GreaterThan'
    threshold: 10
    aggregation: 'Count'
    window: 'PT15M'
    dimensions: [
      {
        name: 'StatusCode'
        operator: 'Include'
        values: [
          '429'
        ]
      }
    ]
  }
]

resource metricAlertRules 'Microsoft.Insights/metricAlerts@2018-03-01' = [for alert in metricAlerts: {
  name: alert.name
  location: 'global'
  properties: {
    description: alert.description
    severity: alert.severity
    enabled: true
    scopes: [
      alert.scope
    ]
    evaluationFrequency: 'PT5M'
    windowSize: alert.window
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          name: alert.metric
          metricNamespace: alert.namespace
          metricName: alert.metric
          operator: alert.operator
          threshold: alert.threshold
          timeAggregation: alert.aggregation
          dimensions: alert.dimensions
        }
      ]
    }
    actions: [
      { actionGroupId: actionGroup.id }
    ]
  }
}]

// Security events (ParishLife.Api/Authorization/SecurityEvents.cs): one warning per event with the event name, account id, client address,
// path and a short detail code; never a password, code, token or email. Thresholds from the hardening report 03, handoff 1.
var securityQuery = '''
let ev = traces
  | where isnotempty(customDimensions.SecurityEvent)
  | project e = tostring(customDimensions.SecurityEvent), ip = tostring(customDimensions.ClientAddress), d = tostring(customDimensions.Detail);
union
  (ev
    | summarize n = count() by e, ip
    | where (e == "security.sign_in_failed" and n > 50) or (e == "security.rate_limited" and n > 20)
        or (e in ("security.mfa_failed", "security.csrf_rejected", "security.turnstile_failed", "security.permission_denied") and n > 30)
    | extend why = "spike from one address"),
  (ev | where e == "security.sign_in_failed" and d == "locked_out" | summarize n = count() by e, ip | extend why = "an account was locked out"),
  (ev | where e == "security.password_reset_requested" | summarize n = count() by e | where n > 10 | extend ip = "", why = "many password reset requests")
'''

// The five workers log "... requires retry. Failure type: X" on each failed pass; they run every 15 s or 1 min, so 10 in 15 minutes is a
// failure that is not clearing by itself.
var workerQuery = '''
traces
| where message has "requires retry"
| summarize n = count() by worker = tostring(split(message, " requires retry")[0])
| where n >= 10
'''

var logAlerts = [
  {
    name: 'parishlife-security-events'
    description: 'Security events: sign-in failures, rate limits, MFA, CSRF, Turnstile or permission refusals spiking from one address; a lockout; many password resets.'
    severity: 2
    query: securityQuery
  }
  {
    name: 'parishlife-background-work-failing'
    description: 'A background worker (billing activation, reservations, notifications, scheduled reports or broadcasts) keeps failing.'
    severity: 2
    query: workerQuery
  }
]

resource logAlertRules 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = [for alert in logAlerts: {
  name: alert.name
  location: appInsights.location
  kind: 'LogAlert'
  properties: {
    displayName: alert.name
    description: alert.description
    severity: alert.severity
    enabled: true
    scopes: [
      appInsights.id
    ]
    // 15 minutes is the cheapest log alert frequency.
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [
        {
          query: alert.query
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    autoMitigate: true
    actions: {
      actionGroups: [
        actionGroup.id
      ]
    }
  }
}]

resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: 'parishlife-monthly'
  properties: {
    category: 'Cost'
    amount: monthlyBudget
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: budgetStartDate
    }
    notifications: {
      actual50: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: [
          alertEmail
        ]
      }
      actual80: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: [
          alertEmail
        ]
      }
      actual100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: [
          alertEmail
        ]
      }
      forecast100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [
          alertEmail
        ]
      }
    }
  }
}

output actionGroupId string = actionGroup.id
