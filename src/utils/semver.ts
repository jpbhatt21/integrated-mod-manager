export function compareVersions(left: string | undefined, right: string): number {
	const parse = (value: string | undefined) => (value || "0.0.0").match(/\d+/g)?.slice(0, 3).map(Number) || [0, 0, 0];
	const a = parse(left);
	const b = parse(right);
	for (let i = 0; i < 3; i++) {
		if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0) ? 1 : -1;
	}
	return 0;
}

export const isVersionOlderThan = (version: string | undefined, target: string) => compareVersions(version, target) < 0;
export const isVersionAtLeast = (version: string | undefined, target: string) => compareVersions(version, target) >= 0;
