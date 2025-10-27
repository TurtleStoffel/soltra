export function fuzzyMatch(str: string, query: string): boolean {
    query = query.toLowerCase();
    str = str.toLowerCase();
    return str.includes(query);
}
