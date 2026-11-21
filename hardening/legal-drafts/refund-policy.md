# Refund policy: review draft (Agent 06, Part A)

> **DRAFT. Not for publication.** This must be reviewed by a lawyer licensed in Lebanon. It is not legal advice.
> Prepared 21 November 2026 on branch `hardening/06-legal`.

## Facts this draft rests on (checked in the code)

- **ParishLife sells nothing online.** There is no payment provider and no card or online payment route (`PROJECT_CONTEXT.md`; online payments are open owner question 23).
- **Parish finance is offline.** Parishes record gifts, numbered receipts, event-registration instalments and refunds, and facility rentals in LBP and USD (`Contribution`, `GiftReceipt`, `RegistrationInstalment`, `RegistrationRefund`, `RentalPayment`). The money changes hands between the person and the parish, outside ParishLife. ParishLife only keeps the record.
- **A platform subscription model exists in the code but is not live.** It has plans, coverage periods, invoices to a parish or an archdiocese, and cash receipts recorded by a platform operator (`PlanDefinition`, `Invoice`, `CashReceipt`, `PayerSchedule`, `docs/operations/subscription-payer-transfer.md`). The docs say plainly: "No credit, proration or refund policy is invented." Refund terms for subscriptions are **Not provided** (`PROJECT_CONTEXT.md`).

---

## Part 1. Text that can be published now (short statement)

This can sit as a short section in the terms of use (after T3 in `terms-of-use.md`) instead of a separate page, because there is nothing to refund. If the owner prefers a page, publish it as `refunds.html`.

**EN**
> **Refunds**
> ParishLife takes no payments online, so there is nothing to refund through ParishLife. Gifts, registration fees, rentals and any refunds that a parish records are arranged directly with that parish, under its own rules; ask the parish office. If ParishLife ever offers paid plans, their refund and cancellation terms will be published here before anyone is charged.

**AR**
> **استرداد المبالغ**
> لا يقبل ParishLife أي دفع عبر الإنترنت، فلا يوجد ما يُستردّ عبر ParishLife. التبرّعات ورسوم التسجيل والإيجارات وأي مبالغ مستردّة تسجّلها رعية تُرتَّب مباشرة مع تلك الرعية وفق قواعدها؛ راجع مكتب الرعية. وإذا قدّم ParishLife يوماً اشتراكات مدفوعة، تُنشر شروط استردادها وإلغائها هنا قبل أن يُطلب من أحد أي مبلغ.

---

## Part 2. Structure for future subscriptions

> **NOT FOR PUBLICATION until there is a paid plan.** Every bracketed item is an owner decision or a point for counsel. Nothing below is decided policy.

**Who buys.** Subscriptions are bought by parishes or archdioceses (the billing representative in the code), not by individual members. This is most likely a business-to-business contract, so consumer withdrawal rights may not apply. `[COUNSEL: confirm whether a parish counts as a consumer under Lebanese Consumer Protection Law No. 659/2005.]`

1. **What is sold:** [PLACEHOLDER: plan names and what each includes], billed [PLACEHOLDER: monthly / yearly], in [PLACEHOLDER: LBP / USD], payable by [PLACEHOLDER: cash, bank transfer, payment provider].
2. **Renewal:** [PLACEHOLDER: does the plan renew automatically?] If it does, we remind the billing representative [PLACEHOLDER: number] days before each renewal, with the price and how to cancel.
3. **Cancelling:** the billing representative can cancel at any time [PLACEHOLDER: in the app / by email to an address]. Cancellation takes effect at [PLACEHOLDER: the end of the paid period / immediately]. Cancelling must be as easy as subscribing.
4. **Refunds:**
   - [PLACEHOLDER: full refund within N days of the first payment?]
   - [PLACEHOLDER: pro-rata refund of unused whole months when cancelling a yearly plan?]
   - [PLACEHOLDER: no refund for a period already used?]
   - Refunds go back by the same means within [PLACEHOLDER: number] days.
5. **Withdrawal right (Lebanon):** `[COUNSEL]` Law No. 659/2005, Art. 55 (as amended in 2014), is reported to let a consumer who contracts at a distance withdraw within 10 days, except where the service has already been used. Confirm whether it applies to parish subscriptions and how it interacts with using the service at once.
6. **EU, only if EU parishes subscribe:** the 14-day withdrawal right (Directive 2011/83/EU) protects consumers only, so it is not expected to apply to parishes. If it ever applies, digital services that start at once need the customer's express request and acknowledgment that the right is lost once the service is fully performed. Auto-renewal and "easy cancellation" rules differ by country `[COUNSEL]`.
7. **Payment problems:** [PLACEHOLDER: what happens if a payment fails or an invoice is unpaid; grace period; what parishes keep access to, at least read-only access and an export of their records].
8. **Price changes:** [PLACEHOLDER: notice period] notice before a new price applies at the next renewal, with the right to cancel before then.
9. **Payer transfers between a parish and its archdiocese:** these affect only future periods and are never retroactive (`subscription-payer-transfer.md`). [PLACEHOLDER: credit or refund rules when the payer changes, which the code does not provide today.]
10. **Contact for billing:** [PLACEHOLDER: billing email address], [PLACEHOLDER: legal name of the operator and address], [PLACEHOLDER: tax or VAT number, if registered].

**Before this is published:** a payment provider is chosen (question 23); the billing representative can see the renewal date and cancel; card data never reaches ParishLife's servers (PCI DSS, Part B item 13); and the checkout links to this policy (Part B item 1).
