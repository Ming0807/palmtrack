import { notFound } from "next/navigation";
import { AssignmentPrototype } from "@/features/field-prototype/assignment-app";
import {
  parsePrototypeState,
  prototypeAssignments,
} from "@/features/field-prototype/model";

type AssignmentPageProps = {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssignmentPage({
  params,
  searchParams,
}: AssignmentPageProps) {
  const [{ assignmentId }, query] = await Promise.all([params, searchParams]);
  if (!prototypeAssignments.some((assignment) => assignment.id === assignmentId)) {
    notFound();
  }

  return (
    <AssignmentPrototype
      assignmentId={assignmentId}
      initialState={parsePrototypeState(query.state)}
    />
  );
}
