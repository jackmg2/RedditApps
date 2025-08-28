import { AppSettings } from '../types/AppSettings.js';

export class ExemptUserUtils {
  static getExemptUsers(settings: AppSettings): string[] {
    return settings.exemptUsers
      .split(';')
      .map(username => username.trim().toLowerCase())
      .filter(username => username.length > 0);
  }

  static isExemptUser(username: string | undefined, exemptUsers: string[]): boolean {
    if (!username) return false;
    return exemptUsers.includes(username.toLowerCase());
  }
}