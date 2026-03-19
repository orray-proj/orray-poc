import { createFileRoute } from "@tanstack/react-router";
import { BindingsCanvas } from "@/components/bindings/bindings-canvas";

export const Route = createFileRoute("/bindings")({
  component: BindingsPage,
});

function BindingsPage() {
  return <BindingsCanvas />;
}
