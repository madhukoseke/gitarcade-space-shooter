/** Deterministic mocked response for GET /api/github/contributions. Not real user data. */
export function mockProfile(username = "octo-tester") {
  const start = Date.UTC(2025, 10, 2);
  const weeks = Array.from({ length: 52 }, (_, w) => ({
    days: Array.from({ length: 7 }, (_, d) => {
      const level = (w * 3 + d * 2) % 5;
      return {
        date: new Date(start + (w * 7 + d) * 86_400_000).toISOString().slice(0, 10),
        count: level * 2,
        level,
      };
    }),
  }));
  const total = weeks.flatMap((w) => w.days).reduce((sum, d) => sum + d.count, 0);
  return {
    username,
    displayName: "Octo Tester",
    avatarUrl: null,
    totalContributions: total,
    calendar: { startDate: weeks[0].days[0].date, endDate: weeks[51].days[6].date, weeks },
  };
}
