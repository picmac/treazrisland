import { PixelButton, PixelInput } from "@/src/components/pixel";

export type RomLookupFormProps = {
  defaultValue?: string;
};

export function RomLookupForm({ defaultValue }: RomLookupFormProps) {
  return (
    <form className="flex flex-col gap-2" method="get">
      <label htmlFor="rom-id" className="text-sm font-semibold uppercase tracking-widest text-foreground/70">
        Load by ROM ID
      </label>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <PixelInput
          id="rom-id"
          name="romId"
          defaultValue={defaultValue}
          placeholder="ex: rom-1234"
          className="flex-1"
        />
        <PixelButton type="submit">Load ROM</PixelButton>
      </div>
    </form>
  );
}
