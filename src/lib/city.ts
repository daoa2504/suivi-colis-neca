// src/lib/city.ts
//
// Les villes sont saisies à la main, et une même ville s'écrit de plusieurs
// façons : « Montréal », « Montreal », « Montréal » avec une espace finale.
// La base en comptait 24 graphies pour 14 villes réelles — d'où des villes
// en double dans les filtres, et des sous-totaux dédoublés sur les documents
// de douane, où deux lignes « Québec » se suivaient avec chacune une partie
// des clients.
//
// Ce module donne la clé qui réunit ces graphies, et choisit celle à
// afficher. Aucun import serveur : il sert aussi bien aux écrans qu'aux API.

/**
 * Clé de rapprochement : insensible à la casse, aux accents, aux espaces
 * multiples, aux traits d'union et aux apostrophes.
 *
 * « Trois-Rivières » et « Trois rivières » donnent la même clé, de même que
 * « NIAMEY » et « Niamey ». Une faute de frappe, elle, reste une ville
 * différente : « Sherbooke » ne deviendra jamais « Sherbrooke » tout seul,
 * et c'est voulu — deviner l'orthographe d'une destination de douane serait
 * plus dangereux que de laisser l'anomalie visible.
 */
export function cityKey(name: string | null | undefined): string {
    if (!name) return "";
    return name
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // accents
        .replace(/[\s\-'’]+/g, " ")
        .trim();
}

/** Même ville, quelle que soit la graphie ? */
export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
    const ka = cityKey(a);
    return ka !== "" && ka === cityKey(b);
}

/** Retire les espaces superflus, sans rien corriger d'autre. */
export function tidyCityName(name: string | null | undefined): string {
    return (name ?? "").replace(/\s+/g, " ").trim();
}

/** NFD sépare la lettre de son accent : il suffit alors de chercher
 *  un signe diacritique. */
function hasAccents(name: string): boolean {
    return /[̀-ͯ]/.test(name.normalize("NFD"));
}

/**
 * Note une graphie, pour choisir la plus présentable d'un groupe.
 *
 * Les accents l'emportent (« Québec » plutôt que « Quebec »), les
 * majuscules intégrales perdent (« GATINEAU »), et chaque mot correctement
 * capitalisé rapporte — ce qui fait préférer « Trois-Rivières » à
 * « Trois rivières ».
 */
export function spellingScore(name: string): number {
    const t = tidyCityName(name);
    if (!t) return -Infinity;

    let score = 0;
    const letters = t.replace(/[^\p{L}]/gu, "");
    if (letters.length > 1 && t === t.toLocaleUpperCase("fr")) score -= 5;
    if (hasAccents(t)) score += 3;
    if (t.includes("-")) score += 1;

    for (const word of t.split(/[\s-]+/)) {
        if (!word) continue;
        const first = word[0];
        if (first === first.toLocaleUpperCase("fr") && first !== first.toLocaleLowerCase("fr")) {
            score += 1;
        } else {
            score -= 1;
        }
    }
    return score;
}

/** La graphie à retenir parmi plusieurs variantes de la même ville. */
export function bestCitySpelling(variants: Iterable<string>): string {
    let best = "";
    let bestScore = -Infinity;
    for (const raw of variants) {
        const t = tidyCityName(raw);
        if (!t) continue;
        const s = spellingScore(t);
        // À note égale, l'ordre alphabétique tranche : le résultat ne doit
        // pas dépendre de l'ordre dans lequel la base a renvoyé les lignes.
        if (s > bestScore || (s === bestScore && t.localeCompare(best, "fr") < 0)) {
            best = t;
            bestScore = s;
        }
    }
    return best;
}

/**
 * Une entrée par ville réelle : la graphie à afficher, et toutes celles
 * qu'elle recouvre — ces dernières servent à filtrer en base, où les
 * anciennes lignes gardent leur orthographe d'origine.
 */
export type CityGroup = {
    key: string;
    label: string;
    variants: string[];
};

export function groupCityNames(names: Iterable<string | null | undefined>): CityGroup[] {
    const buckets = new Map<string, Set<string>>();
    for (const name of names) {
        const t = tidyCityName(name);
        if (!t) continue;
        const k = cityKey(t);
        if (!k) continue;
        if (!buckets.has(k)) buckets.set(k, new Set());
        // La variante conservée est celle de la base, espaces compris :
        // c'est elle qu'il faudra comparer pour retrouver les lignes.
        buckets.get(k)!.add(name as string);
    }

    return Array.from(buckets.entries())
        .map(([key, variants]) => ({
            key,
            label: bestCitySpelling(variants),
            variants: Array.from(variants),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

/** Liste de villes sans doublon, prête pour une liste déroulante. */
export function dedupeCityNames(names: Iterable<string | null | undefined>): string[] {
    return groupCityNames(names).map((g) => g.label);
}

/**
 * Toutes les graphies connues d'une ville choisie dans un filtre.
 *
 * Choisir « Montréal » doit ramener les colis enregistrés « Montreal » :
 * sans ça, le filtre cacherait une partie des colis sans le dire.
 */
export function cityVariantsOf(
    selected: string,
    known: Iterable<string | null | undefined>
): string[] {
    const k = cityKey(selected);
    if (!k) return [];
    const found = new Set<string>();
    for (const name of known) {
        if (cityKey(name) === k) found.add(name as string);
    }
    // Le choix lui-même, au cas où il ne figure pas dans la liste connue.
    if (found.size === 0) found.add(selected);
    return Array.from(found);
}

/**
 * Regroupe des éléments par ville, sous une seule entrée par ville réelle.
 * Utilisé par les documents : la liste de colisage et les exports doivent
 * présenter un seul sous-total par destination.
 */
export function groupByCity<T>(
    items: T[],
    getCity: (item: T) => string | null | undefined,
    fallbackLabel = "Sans ville"
): { key: string; label: string; items: T[] }[] {
    const buckets = new Map<string, { label: string; variants: Set<string>; items: T[] }>();

    for (const item of items) {
        const raw = tidyCityName(getCity(item));
        const k = raw ? cityKey(raw) : "";
        const bucket = buckets.get(k);
        if (bucket) {
            if (raw) bucket.variants.add(raw);
            bucket.items.push(item);
        } else {
            buckets.set(k, {
                label: raw || fallbackLabel,
                variants: new Set(raw ? [raw] : []),
                items: [item],
            });
        }
    }

    return Array.from(buckets.entries())
        .map(([key, b]) => ({
            key,
            label: b.variants.size > 0 ? bestCitySpelling(b.variants) : b.label,
            items: b.items,
        }))
        .sort((a, b) => {
            // « Sans ville » en dernier : c'est une absence, pas une destination.
            if (a.key === "" ) return 1;
            if (b.key === "") return -1;
            return a.label.localeCompare(b.label, "fr");
        });
}
