export function fuzzyMatch(str: string, query: string): boolean {
    query = query.toLowerCase();
    str = str.toLowerCase();
    let qIdx = 0;
    for (let sIdx = 0; sIdx < str.length && qIdx < query.length; sIdx++) {
        if (str[sIdx] === query[qIdx]) qIdx++;
    }
    return qIdx === query.length;
}
