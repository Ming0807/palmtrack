import { render, screen } from "@testing-library/react";
import { AssignmentRoute } from "./assignment-route";

describe("AssignmentRoute", () => {
  it("renders consent before the locked baseline boundary without response controls", () => {
    const { container } = render(
      <AssignmentRoute assignmentId="SSK-024" prototypeState="default" />,
    );

    const consent = screen.getByText("แจ้งข้อมูลและยินยอม");
    const baseline = screen.getAllByText("ข้อมูลพื้นฐาน")[0];
    expect(
      consent.compareDocumentPosition(baseline) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("รออนุมัติเครื่องมือวิจัย")).toBeVisible();
    expect(container.querySelector("form")).not.toBeInTheDocument();
    expect(container.querySelector("input, textarea, select")).not.toBeInTheDocument();
  });
});
