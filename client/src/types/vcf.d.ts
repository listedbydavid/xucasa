declare module "vcf" {
  class VCard {
    static parse(input: string): VCard[];
    get(field: string): { valueOf(): string } | Array<{ valueOf(): string }> | null;
  }
  export = VCard;
}
