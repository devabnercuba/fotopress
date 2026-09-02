export type CompColor = "green" | "blue" | "orange" | "yellow" | "gray";

const styles: Record<CompColor, { dot: string; chip: string; bar: string; text: string }> = {
  green: {
    dot: "bg-comp-green",
    chip: "bg-comp-green/10 text-comp-green",
    bar: "border-l-comp-green",
    text: "text-comp-green",
  },
  blue: {
    dot: "bg-comp-blue",
    chip: "bg-comp-blue/10 text-comp-blue",
    bar: "border-l-comp-blue",
    text: "text-comp-blue",
  },
  orange: {
    dot: "bg-comp-orange",
    chip: "bg-comp-orange/10 text-comp-orange",
    bar: "border-l-comp-orange",
    text: "text-comp-orange",
  },
  yellow: {
    dot: "bg-comp-yellow",
    chip: "bg-comp-yellow/10 text-comp-yellow",
    bar: "border-l-comp-yellow",
    text: "text-comp-yellow",
  },
  gray: {
    dot: "bg-comp-gray",
    chip: "bg-comp-gray/10 text-comp-gray",
    bar: "border-l-comp-gray",
    text: "text-comp-gray",
  },
};

export function compStyle(color: string | null | undefined) {
  return styles[(color ?? "gray") as CompColor] ?? styles.gray;
}
