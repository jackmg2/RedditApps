export const randomId = (): string => {
    return Math.floor(Math.random() * Date.now()).toString();
  };

  export function isNullOrEmpty(value: any): boolean {
    return (value == null || value == undefined || value.trim().length === 0);
  }