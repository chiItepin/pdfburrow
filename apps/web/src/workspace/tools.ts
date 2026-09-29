import { Files, Images, Scissors } from "lucide-react";

export const tools = [
  {
    route: "merge",
    label: "Merge PDFs",
    description: "Bring multiple PDFs together in the order you choose.",
    icon: Files,
  },
  {
    route: "split",
    label: "Split / Extract",
    description: "Keep the pages you need, or split one PDF into several.",
    icon: Scissors,
  },
  {
    route: "images",
    label: "Images to PDF",
    description: "Turn your JPEG and PNG images into a PDF.",
    icon: Images,
  },
] as const;
