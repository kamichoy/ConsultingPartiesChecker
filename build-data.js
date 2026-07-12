// Rebuilds the full dataset used by index.html from live sources:
//  - Indiana Landmarks Preservation Directory (AJAX)   -> local preservation orgs
//  - Indiana Landmarks county pages                     -> regional/field office
//  - Indiana Historical Society "find who you need"     -> historian + historical/genealogical orgs
//  - HUD eGIS Tribal Directory Assistance Tool (TDAT)    -> tribal contacts
// Output: data.js (a plain JS file defining CONSULTING_PARTIES_DATA, loaded via
// <script src="data.js">) so index.html works from a double-clicked file://
// URL with no local server and no fetch()/CORS issues.
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// A browser-like UA is required for indianahistory.org (bare "Mozilla/5.0" gets a 403).
const UA = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' } };

const COUNTIES = [
    ["adams","Adams"],["allen","Allen"],["bartholomew","Bartholomew"],["benton","Benton"],
    ["blackford","Blackford"],["boone","Boone"],["brown","Brown"],["carroll","Carroll"],
    ["cass","Cass"],["clark","Clark"],["clay","Clay"],["clinton","Clinton"],
    ["crawford","Crawford"],["daviess","Daviess"],["dearborn","Dearborn"],["decatur","Decatur"],
    ["dekalb","DeKalb"],["delaware","Delaware"],["dubois","Dubois"],["elkhart","Elkhart"],
    ["fayette","Fayette"],["floyd","Floyd"],["fountain","Fountain"],["franklin","Franklin"],
    ["fulton","Fulton"],["gibson","Gibson"],["grant","Grant"],["greene","Greene"],
    ["hamilton","Hamilton"],["hancock","Hancock"],["harrison","Harrison"],["hendricks","Hendricks"],
    ["henry","Henry"],["howard","Howard"],["huntington","Huntington"],["jackson","Jackson"],
    ["jasper","Jasper"],["jay","Jay"],["jefferson","Jefferson"],["jennings","Jennings"],
    ["johnson","Johnson"],["knox","Knox"],["kosciusko","Kosciusko"],["lagrange","LaGrange"],
    ["lake","Lake"],["laporte","LaPorte"],["lawrence","Lawrence"],["madison","Madison"],
    ["marion","Marion"],["marshall","Marshall"],["martin","Martin"],["miami","Miami"],
    ["monroe","Monroe"],["montgomery","Montgomery"],["morgan","Morgan"],["newton","Newton"],
    ["noble","Noble"],["ohio","Ohio"],["orange","Orange"],["owen","Owen"],
    ["parke","Parke"],["perry","Perry"],["pike","Pike"],["porter","Porter"],
    ["posey","Posey"],["pulaski","Pulaski"],["putnam","Putnam"],["randolph","Randolph"],
    ["ripley","Ripley"],["rush","Rush"],["scott","Scott"],["shelby","Shelby"],
    ["spencer","Spencer"],["st-joseph","St. Joseph"],["starke","Starke"],["steuben","Steuben"],
    ["sullivan","Sullivan"],["switzerland","Switzerland"],["tippecanoe","Tippecanoe"],["tipton","Tipton"],
    ["union","Union"],["vanderburgh","Vanderburgh"],["vermillion","Vermillion"],["vigo","Vigo"],
    ["wabash","Wabash"],["warren","Warren"],["warrick","Warrick"],["washington","Washington"],
    ["wayne","Wayne"],["wells","Wells"],["white","White"],["whitley","Whitley"]
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function slugify(name) {
    return name.toLowerCase().replace(/[.']/g, '').trim().replace(/\s+/g, '-');
}

// Decodes HTML entities / strips any leftover tags in a single fragment.
// Uses a 'body' selector (not 'div') so a stray unbalanced tag in the
// fragment can't get parsed into nested elements that double-count text.
function decodeHtml(fragment) {
    return cheerio.load(`<body>${fragment}</body>`)('body').text().replace(/\s+/g, ' ').trim();
}

function chunkToOrg(chunkHtml) {
    let html = chunkHtml;
    const nameMatch = html.match(/<strong>([\s\S]*?)<\/strong>/i);
    const name = nameMatch ? decodeHtml(nameMatch[1]) : null;
    html = html.replace(/<strong>[\s\S]*?<\/strong>/i, '');

    // Single pass over every <a>, keyed off its href regardless of attribute
    // order (some indianahistory.org markup puts class/title before href,
    // which a "href must come right after <a" regex would miss).
    let email = '';
    let website = '';
    html = html.replace(/<a\s+([^>]*)>[\s\S]*?<\/a>/gi, (m, attrs) => {
        const hrefMatch = attrs.match(/href=['"]([^'"]+)['"]/i);
        const href = hrefMatch ? hrefMatch[1].trim() : '';
        if (/^mailto:/i.test(href)) {
            if (!email) email = href.replace(/^mailto:/i, '').trim();
        } else if (href && !website) {
            website = href.replace(/^https?:\/\/(https?:\/\/)/i, '$1').trim();
        }
        return '';
    });

    // Split into lines BEFORE decoding, so decoding never re-merges them.
    const lines = html.split(/<br\s*\/?>/i)
        .map(decodeHtml)
        .filter(Boolean)
        .filter(l => l.toLowerCase() !== 'website:');

    return { name: name || lines[0] || 'Unknown', lines, email, website };
}

async function getNonce() {
    const { data } = await axios.get('https://www.indianalandmarks.org/resources/indiana-preservation-directory/', UA);
    const m = data.match(/preservation_afp_nonce":"([a-f0-9]+)"/);
    if (!m) throw new Error('Could not find preservation_afp_nonce on directory page');
    return m[1];
}

async function getOrgs(slug, nonce) {
    const body = new URLSearchParams({
        action: 'preservation_filter_posts',
        preservation_afp_nonce: nonce,
        location: `${slug}-county`
    });
    const { data } = await axios.post('https://www.indianalandmarks.org/wp-admin/admin-ajax.php', body, UA);
    const html = data && data.response && data.response[0];
    if (!html || /no directory information/i.test(html)) return [];

    const $ = cheerio.load(html);
    const inner = $('.preservation-info-wrapper > div').first().html() || '';
    const chunks = inner.split(/<br>\s*<br>/i).map(c => c.trim()).filter(Boolean);
    return chunks.map(chunkToOrg)
        .filter(o => o.name && o.name !== 'Unknown')
        .map(o => ({ ...o, source: 'landmarks' }));
}

// indianahistory.org lists every county on a single static page (an accordion),
// so this is one request instead of 92.
async function getHistoricalSocietyOrgs() {
    const { data } = await axios.get(
        'https://indianahistory.org/across-indiana/hometown-resources/find-who-you-need-by-county/',
        UA
    );
    const $ = cheerio.load(data);
    const byCounty = {};
    $('.intAccBlock').each((_, block) => {
        const $block = $(block);
        let countyName = $block.find('.intAccLabel').first().text().replace(/\s*County\s*$/i, '').trim();
        if (/^la\s*porte$/i.test(countyName)) countyName = 'LaPorte';
        const slug = slugify(countyName);

        const orgs = [];
        $block.find('.intAccSlideUpWrap > p').each((__, p) => {
            const org = chunkToOrg($(p).html() || '');
            if (org.name && org.name !== 'Unknown') orgs.push({ ...org, source: 'ihs' });
        });
        byCounty[slug] = orgs;
    });
    return byCounty;
}

// Merges two org lists, folding exact-name-match duplicates (after normalizing
// case/punctuation) into a single entry that unions their contact fields and
// tags which source(s) it came from. Names that merely look similar (e.g. a
// museum listed under a slightly different name on each site) are left as
// separate entries on purpose — merging on a fuzzy match risks collapsing two
// genuinely different organizations into one.
function normalizeOrgName(name) {
    return name.toLowerCase()
        .replace(/\binc\b\.?/g, '')
        .replace(/\bincorporated\b/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Fingerprints a contact-info line for near-duplicate detection when merging
// the two sources' line lists. A plain lowercase/punctuation-stripped compare
// misses common real-world variants of the *same* fact — "812-384-8400" vs
// "(812) 384-8400", or a 5-digit zip vs its ZIP+4 form — which otherwise show
// up as two confusing, near-identical lines in one merged card.
function lineFingerprint(line) {
    const zipCollapsed = line.replace(/(\d{5})-\d{4}\b/g, '$1');
    const digits = zipCollapsed.replace(/\D/g, '');
    const nonSpaceLen = zipCollapsed.replace(/\s/g, '').length;
    if (digits.length >= 7 && digits.length / nonSpaceLen > 0.5) {
        return `phone:${digits}`;
    }
    return zipCollapsed.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mergeOrgLists(landmarksOrgs, ihsOrgs) {
    const merged = [];
    const bySlug = new Map();
    for (const org of landmarksOrgs) {
        const entry = { name: org.name, lines: [...org.lines], email: org.email, website: org.website, sources: [org.source] };
        merged.push(entry);
        bySlug.set(normalizeOrgName(org.name), entry);
    }
    for (const org of ihsOrgs) {
        const key = normalizeOrgName(org.name);
        const existing = bySlug.get(key);
        if (existing) {
            if (!existing.sources.includes(org.source)) existing.sources.push(org.source);
            existing.email = existing.email || org.email;
            existing.website = existing.website || org.website;
            const seen = new Set(existing.lines.map(lineFingerprint));
            for (const l of org.lines) {
                const fp = lineFingerprint(l);
                if (!seen.has(fp)) {
                    existing.lines.push(l);
                    seen.add(fp);
                }
            }
        } else {
            const entry = { name: org.name, lines: [...org.lines], email: org.email, website: org.website, sources: [org.source] };
            merged.push(entry);
            bySlug.set(key, entry);
        }
    }
    return merged;
}

async function getOffice(slug) {
    const { data } = await axios.get(`https://www.indianalandmarks.org/county/${slug}-county/`, UA);
    const $ = cheerio.load(data);
    const box = $('.regional-office-content').first();
    if (!box.length) return null;
    const get = (cls) => box.find(`.${cls}`).first().text().replace(/\s+/g, ' ').trim();
    const titleEl = box.find('.regional-office-title').first();
    const office = {
        office: get('regional-office-title'),
        city: get('regional-intro-title'),
        address1: get('regional-address-1'),
        address2: get('regional-address-2'),
        cityStateZip: get('regional-city-state-zip'),
        phone: get('regional-phone'),
        email: get('regional-email'),
        staffUrl: titleEl.closest('a').attr('href') || ''
    };
    return office.office ? office : null;
}

// Staff are listed on the office's own /contact/ page, not the county page —
// and the same ~9 offices cover all 92 counties, so this is cached per URL
// rather than re-fetched for every county.
const staffCache = new Map();
async function getStaff(url) {
    if (!url) return [];
    if (staffCache.has(url)) return staffCache.get(url);
    const staff = await (async () => {
        const { data } = await axios.get(url, UA);
        const $ = cheerio.load(data);
        const box = $('.office-staff-content').first();
        if (!box.length) return [];
        const names = box.find('.staff-name').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get();
        const emails = box.find('.staff-email').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get();
        return names.map((name, i) => ({ name, email: emails[i] || '' })).filter(s => s.name);
    })();
    staffCache.set(url, staff);
    return staff;
}

async function getTribes() {
    const url = "https://egis.hud.gov/arcgis/rest/services/tdat/TDAT/MapServer/3/query?where=STATE_NAME%3D%27Indiana%27&outFields=TRIBAL_NAME,URL,FIRST_NAME,LAST_NAME,TITLE,STREET_ADDRESS,CITY,STATE,ZIP_CODE,WORK_PHONE,EMAIL,COUNTY_NAME&f=json";
    const { data } = await axios.get(url);
    if (data.exceededTransferLimit) throw new Error('HUD TDAT response was paginated; need to page through results');
    const byCounty = {};
    for (const f of data.features) {
        const a = f.attributes;
        const slug = slugify(a.COUNTY_NAME);
        if (!byCounty[slug]) byCounty[slug] = [];
        byCounty[slug].push({
            name: a.TRIBAL_NAME,
            contact: [a.FIRST_NAME, a.LAST_NAME].filter(Boolean).join(' '),
            title: a.TITLE || '',
            address: [a.STREET_ADDRESS, [a.CITY, a.STATE].filter(Boolean).join(', '), a.ZIP_CODE].filter(Boolean).join(', '),
            phone: a.WORK_PHONE || '',
            email: a.EMAIL || '',
            website: a.URL || ''
        });
    }
    return byCounty;
}

(async () => {
    console.log('Fetching HUD tribal contact data for Indiana...');
    const tribes = await getTribes();
    console.log(`  -> ${Object.values(tribes).reduce((n, a) => n + a.length, 0)} tribal contacts across ${Object.keys(tribes).length} counties`);

    console.log('Fetching Indiana Historical Society county listings...');
    const ihsOrgs = await getHistoricalSocietyOrgs();
    console.log(`  -> ${Object.values(ihsOrgs).reduce((n, a) => n + a.length, 0)} listings across ${Object.keys(ihsOrgs).length} counties`);

    console.log('Fetching preservation directory nonce...');
    const nonce = await getNonce();

    const result = {};
    let mergedCount = 0;
    for (const [slug, name] of COUNTIES) {
        process.stdout.write(`Fetching ${name} County... `);
        let landmarksOrgs = [], office = null;
        try {
            landmarksOrgs = await getOrgs(slug, nonce);
        } catch (e) {
            console.log(`\n  orgs failed for ${slug}: ${e.message}`);
        }
        await sleep(250);
        try {
            office = await getOffice(slug);
            if (office && office.staffUrl) {
                office.staff = await getStaff(office.staffUrl);
                await sleep(250);
            }
            if (office) delete office.staffUrl;
        } catch (e) {
            console.log(`\n  office failed for ${slug}: ${e.message}`);
        }
        await sleep(250);

        const orgs = mergeOrgLists(landmarksOrgs, ihsOrgs[slug] || []);
        mergedCount += orgs.filter(o => o.sources.length > 1).length;

        result[slug] = {
            name: `${name} County`,
            office,
            orgs,
            tribes: tribes[slug] || []
        };
        console.log(`orgs=${orgs.length} office=${office ? 'yes' : 'no'} staff=${office && office.staff ? office.staff.length : 0} tribes=${(tribes[slug] || []).length}`);
    }
    console.log(`\n${mergedCount} organizations were listed on both sites and merged into one entry.`);

    const out = `// Auto-generated by build-data.js. Do not edit by hand — re-run the script instead.\nconst CONSULTING_PARTIES_DATA = ${JSON.stringify(result, null, 2)};\n`;
    fs.writeFileSync('data.js', out);
    console.log('\nWrote data.js');
})().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
