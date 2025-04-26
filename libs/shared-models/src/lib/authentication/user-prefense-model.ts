export interface ScreenPreferencesModel {
  userId: string;
  preferences: { [key: string]: boolean }; // e.g., { "home": true, "dashboard": false }
}
