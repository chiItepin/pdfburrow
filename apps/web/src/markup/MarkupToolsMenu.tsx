import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
} from "@repo/core-ui";
import { MousePointer2, Hand, Pencil, Highlighter, Type, Signature } from "lucide-react";
import type { MarkupTool } from "./usePageGestures";
import { useMenubarAction } from "./useMenubarAction";

export const markupTools = [
  { value: "select", label: "Select", icon: MousePointer2 },
  { value: "hand", label: "Hand", icon: Hand },
  { value: "ink", label: "Ink", icon: Pencil },
  { value: "highlight", label: "Highlight", icon: Highlighter },
  { value: "note", label: "Note", icon: Type },
] as const;

export const MarkupToolsMenu = ({
  tool,
  disabled,
  canNote,
  onTool,
  onSignature,
  onHighlight,
  onNote,
}: {
  tool: MarkupTool;
  disabled: boolean;
  canNote: boolean;
  onTool: (tool: MarkupTool) => void;
  onSignature: () => void;
  onHighlight: () => void;
  onNote: () => void;
}) => {
  const { trigger, defer, onCloseAutoFocus } = useMenubarAction();
  return (
    <MenubarMenu>
      <MenubarTrigger ref={trigger}>Tools</MenubarTrigger>
      <MenubarContent onCloseAutoFocus={onCloseAutoFocus}>
        <MenubarRadioGroup
          value={tool}
          onValueChange={(value) => {
            const choice = markupTools.find((choice) => choice.value === value);
            if (choice) {
              onTool(choice.value);
            }
          }}
        >
          {markupTools.map(({ value, label, icon: Icon }) => (
            <MenubarRadioItem
              key={value}
              value={value}
              disabled={disabled || (value === "note" && !canNote)}
            >
              <Icon aria-hidden="true" />
              {label}
            </MenubarRadioItem>
          ))}
        </MenubarRadioGroup>
        <MenubarSeparator />
        <MenubarItem disabled={disabled} onSelect={defer(onSignature)}>
          <Signature aria-hidden="true" />
          Draw signature...
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem disabled={disabled} onSelect={onHighlight}>
          Add centered highlight
        </MenubarItem>
        <MenubarItem disabled={disabled || !canNote} onSelect={defer(onNote)}>
          Place note at center
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
