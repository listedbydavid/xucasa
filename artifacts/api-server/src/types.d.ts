// Type declarations for modules without @types packages
declare module "vcf" {
  class VCard {
    static parse(input: string): VCard[];
    get(field: string): any;
    valueOf(): string;
  }
  export default VCard;
}
