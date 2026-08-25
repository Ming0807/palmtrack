import { FieldPrototype } from "@/features/field-prototype/prototype-app";
import {
  parsePrototypeState,
  parseVariant,
} from "@/features/field-prototype/model";

type FieldPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FieldPage({ searchParams }: FieldPageProps) {
  const query = await searchParams;
  return (
    <FieldPrototype
      initialState={parsePrototypeState(query.state)}
      initialVariant={parseVariant(query.variant)}
    />
  );
}
