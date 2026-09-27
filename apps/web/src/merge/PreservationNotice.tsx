interface PreservationNoticeProps {
  disabled: boolean;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}

export const PreservationNotice = ({
  disabled,
  acknowledged,
  onAcknowledge,
}: PreservationNoticeProps) => (
  <fieldset disabled={disabled} className="mt-6 rounded-lg border p-4">
    <legend className="px-1 font-semibold">Before you merge</legend>
    <p className="mb-3 text-sm">
      This is a page-focused rewrite, not a lossless copy. Annotations and visible marks may change
      or disappear. Bookmarks, attachments, metadata, accessibility tags, and PDF/A guarantees are
      not preserved. Feature detection is not exhaustive.
    </p>
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={acknowledged}
        className="mt-1 size-4 shrink-0 accent-primary"
        onChange={(event) => onAcknowledge(event.target.checked)}
      />
      <span className="text-sm">I understand these limitations for the current PDF inputs.</span>
    </label>
  </fieldset>
);
