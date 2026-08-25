import { redirect } from "next/navigation";

export default function Home() {
  redirect("/prototype/field?variant=A");
}
