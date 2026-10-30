export type Tally = { percents: number[]; leaders: number[] };

// Whole percents by the largest remainder method, so they add up to exactly 100 when there are votes. Each option gets
// the floor of its share, and the points left go to the largest remainders, the lower index first on a tie.
export function tally(counts: number[]): Tally {
	const total = counts.reduce((sum, count) => sum + count, 0);
	if (total === 0) return { percents: counts.map(() => 0), leaders: [] };

	const shares = counts.map((count) => (count * 100) / total);
	const percents = shares.map(Math.floor);
	const left = 100 - percents.reduce((sum, percent) => sum + percent, 0);
	const byRemainder = shares
		.map((share, index) => ({ index, remainder: share - Math.floor(share) }))
		.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
	for (const { index } of byRemainder.slice(0, left)) percents[index] = (percents[index] ?? 0) + 1;

	const max = Math.max(...counts);
	const leaders = counts.flatMap((count, index) => (count === max ? [index] : []));
	return { percents, leaders };
}
