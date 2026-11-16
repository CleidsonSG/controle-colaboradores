import type { Metadata } from "next";
import UsuariosView from "@/components/usuarios-view";

export const metadata: Metadata = { title: "Usuários" };

export default function UsersPage() {
  return <UsuariosView />;
}
