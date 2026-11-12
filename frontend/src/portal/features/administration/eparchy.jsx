/* The eparchy page for administrators outside the bishop's menu: the same read-only parish list the
   bishop sees (the API's bishop overview), for the archdioceses the account administers. Eparchy
   announcements and people or sacrament aggregates have no API and are not shown.
   Main member: eparchy. */
import { Eparchy } from '../oversight/oversight.jsx';

export function eparchy() {
  return <Eparchy />;
}
