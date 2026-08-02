// Zeitbasierte Hysterese für Sichtbarkeits-Booleans: Ein Glied gilt erst als sichtbar,
// wenn die Bedingung ONMS lang stabil anliegt, und erst als unsichtbar nach OFFMS —
// verhindert das frameweise Flackern zwischen Track- und Rest-Pose an der Schwellwertgrenze.
export class VisibilityGate {
  private state = false;
  private pendingSince: number | null = null;

  constructor(
    private readonly onMs = 150,
    private readonly offMs = 400,
  ) {}

  update(raw: boolean, now: number): boolean {
    if (raw === this.state) {
      this.pendingSince = null;
      return this.state;
    }
    if (this.pendingSince === null) {
      this.pendingSince = now;
      return this.state;
    }
    const needed = raw ? this.onMs : this.offMs;
    if (now - this.pendingSince >= needed) {
      this.state = raw;
      this.pendingSince = null;
    }
    return this.state;
  }

  reset(): void {
    this.state = false;
    this.pendingSince = null;
  }
}
