export class SampleEvent {
  constructor(
    public readonly eventId: string,
    public readonly payload: Record<string, unknown>,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
