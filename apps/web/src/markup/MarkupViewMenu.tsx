import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarRadioGroup,
  MenubarRadioItem,
} from "@repo/core-ui";
import type { MarkupZoom } from "./MarkupPage";
import { useMenubarAction } from "./useMenubarAction";

export const MarkupViewMenu = ({
  page,
  count,
  zoom,
  disabled,
  onPage,
  onZoom,
  onGoToPage,
  onZoomLevel,
}: {
  page: number;
  count: number;
  zoom: MarkupZoom;
  disabled: boolean;
  onPage: (page: number) => void;
  onZoom: (zoom: MarkupZoom) => void;
  onGoToPage: () => void;
  onZoomLevel: () => void;
}) => {
  const { trigger, defer, onCloseAutoFocus } = useMenubarAction();
  return (
    <MenubarMenu>
      <MenubarTrigger ref={trigger}>View</MenubarTrigger>
      <MenubarContent onCloseAutoFocus={onCloseAutoFocus}>
        <MenubarItem disabled={disabled || page <= 1} onSelect={() => onPage(page - 1)}>
          Previous page
        </MenubarItem>
        <MenubarItem disabled={disabled || page >= count} onSelect={() => onPage(page + 1)}>
          Next page
        </MenubarItem>
        <MenubarItem disabled={disabled} onSelect={defer(onGoToPage)}>
          Go to page...
        </MenubarItem>
        <MenubarSeparator />
        <MenubarRadioGroup
          value={String(zoom)}
          onValueChange={(value) => {
            if (value === "page" || value === "width") {
              onZoom(value);
            }
          }}
        >
          <MenubarRadioItem value="page" disabled={disabled}>
            Fit page
          </MenubarRadioItem>
          <MenubarRadioItem value="width" disabled={disabled}>
            Fit width
          </MenubarRadioItem>
        </MenubarRadioGroup>
        <MenubarItem
          disabled={disabled || zoom === 25}
          onSelect={() => onZoom(Math.max(25, (typeof zoom === "number" ? zoom : 100) - 25))}
        >
          Zoom out
        </MenubarItem>
        <MenubarItem
          disabled={disabled || zoom === 400}
          onSelect={() => onZoom(Math.min(400, (typeof zoom === "number" ? zoom : 100) + 25))}
        >
          Zoom in
        </MenubarItem>
        <MenubarItem disabled={disabled} onSelect={defer(onZoomLevel)}>
          Zoom level...
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
