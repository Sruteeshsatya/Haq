import type { Metadata } from "next";
import CaseNotFound from "../components/CaseNotFound";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return <CaseNotFound />;
}
