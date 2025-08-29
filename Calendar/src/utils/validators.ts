export const randomId = (): string => {
  return Math.floor(Math.random() * Date.now()).toString();
};

export const isValidDate = (date: string): boolean => {
  const dateFormatRegex = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

  if (!dateFormatRegex.test(date)) {
    return false;
  }

  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);

  return dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day;
};

export const isValidDateRange = (dateBegin: string, dateEnd: string): boolean => {
  const beginDate = new Date(dateBegin);
  const endDate = new Date(dateEnd);
  return beginDate <= endDate;
};

export const isValidHexColor = (color: string): boolean => {
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexColorRegex.test(color);
};

export const isValidUrl = (url: string): boolean => {
  return (url === '' || url === undefined) || url.toLowerCase().startsWith('https://');
};