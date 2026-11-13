import type { Metadata } from "next";
import EmployeesView from "@/components/employees-view";

export const metadata: Metadata = { title: "Funcionários" };

export default function EmployeesPage() {
  return <EmployeesView />;
}
