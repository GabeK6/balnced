import { redirect } from "next/navigation";

/** Old route — retirement planning (Roth, 401(k), invest %) now lives on /retirement */
export default function InvestmentsRedirectPage() {
  redirect("/retirement");
}
