import { CustomStatsInfos } from "../config";
import { useColorModeValue } from "@chakra-ui/react";

export const LeagueLogos = {
    orque: '/league_icons_nobg/orca.png',
    baleine: '/league_icons_nobg/whale.png',
    requin: '/league_icons_nobg/shark.png',
    poisson: '/league_icons_nobg/fish.png',
    crevette: '/league_icons_nobg/shrimp.png',
    narval: '/league_icons_nobg/narwhal.png',
    dauphin: '/league_icons_nobg/dolphin.png',
    tortue: '/league_icons_nobg/turtle.png',
    hippocampe: '/league_icons_nobg/seahorse.png',
    plancton: '/league_icons_nobg/plankton.png'
};
export const useLeagueColors = () => ({
    orque: useColorModeValue('#3399ff', '#1a73e8'),  // Light mode: Intense blue, Dark mode: Darker blue
    baleine: useColorModeValue('#66b2ff', '#3b82f6'),  // Light mode: Light blue, Dark mode: Slightly darker
    requin: useColorModeValue('#80ccff', '#4ea9ff'),  // Light mode: Sky blue, Dark mode: Deeper sky blue
    narval: useColorModeValue('#99e6ff', '#66bfff'),  // Light mode: Very light blue, Dark mode: Slightly darker
    dauphin: useColorModeValue('#b3ffff', '#80e9ff'),  // Light mode: Cyan, Dark mode: Deeper cyan
    tortue: useColorModeValue('#ccffe6', '#99f6df'),  // Light mode: Turquoise cyan, Dark mode: Deeper turquoise
    poisson: useColorModeValue('#b3ffcc', '#80f2b2'),  // Light mode: Pale mint green, Dark mode: Deeper mint green
    hippocampe: useColorModeValue('#99ffb3', '#66e59b'),  // Light mode: Pale green, Dark mode: Deeper pale green
    crevette: useColorModeValue('#80ff99', '#4fd587'),  // Light mode: Light green, Dark mode: Deeper light green
    plancton: useColorModeValue('#66ff80', '#39c76d')  // Light mode: Very light green, Dark mode: Deeper very light green
});


export const useColors = () => ({
    bgColor: useColorModeValue('white', 'gray.800'),
    blackTextColor: useColorModeValue('gray.600', 'gray.200'),
    borderColor: useColorModeValue('gray.200', 'gray.700'),
    linkColor: useColorModeValue('gray.600', 'gray.200'),
    linkHoverColor: useColorModeValue('gray.800', 'white'),
    linkActiveColor: useColorModeValue('cyan.500', 'pink.500'),
    blueButton: useColorModeValue('cyan.500', 'cyan.800'),
    blueButtonHover: useColorModeValue('cyan.600', 'cyan.900'),
    pinkButton: useColorModeValue('pink.500', 'pink.800'),
    pinkButtonHover: useColorModeValue('pink.600', 'pink.900'),
    cyanTextColor: useColorModeValue('cyan.700', 'cyan.200'),
    pinkTextColor: useColorModeValue('pink.500', 'pink.200'),
    tabBg: useColorModeValue('cyan.100', 'cyan.900'),
    tabSelectedBg: useColorModeValue('cyan.500', 'cyan.300'),
    tabColor: useColorModeValue('gray.700', 'white'),
    tabSelectedColor: useColorModeValue('white', 'black'),
    panelBg: useColorModeValue('cyan.50', 'gray.700'),
    lighterPanelBg: useColorModeValue('cyan.100', 'gray.600'),
    darkTextColor: useColorModeValue('darkslategrey', 'gray.50'),
    headingColor: useColorModeValue('teal.500', 'teal.300'),
});

export const LeagueNames = [
    'plancton', 'crevette', 'hippocampe',
    'poisson', 'tortue', 'dauphin',
    'narval', 'requin', 'baleine', 'orque'
];

export const LeagueDisplayNames = {
    plancton: { en: 'Plankton', fr: 'Plancton' },
    crevette: { en: 'Shrimp', fr: 'Crevette' },
    hippocampe: { en: 'Seahorse', fr: 'Hippocampe' },
    poisson: { en: 'Fish', fr: 'Poisson' },
    tortue: { en: 'Turtle', fr: 'Tortue' },
    dauphin: { en: 'Dolphin', fr: 'Dauphin' },
    narval: { en: 'Narwhal', fr: 'Narval' },
    requin: { en: 'Shark', fr: 'Requin' },
    baleine: { en: 'Whale', fr: 'Baleine' },
    orque: { en: 'Orca', fr: 'Orque' },
};

export const banners = ['banner.png', 'banner2.png', 'banner3.png', 'banner4.png'];

export const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);


export const AgentStatus = Object.freeze({
    'ACTIVE': 'active',
    'INACTIVE': 'inactive',
    'PENDING': 'pending',
    'DELETED': 'deleted',
    'INVALID': 'invalid',
    'QUARANTINE': 'quarantine',
});

export const FightStatus = Object.freeze({
    'SCHEDULED': 'scheduled',
    'IN_PROGRESS': 'in_progress',
    'DONE': 'done',
    'CANCELLED': 'cancelled'
});


export const PalmaresInfo = [
    {
        icon: 'cliff.png',
        titleBest: { en: 'Best Elo', fr: 'Meilleur ELO' },
        titleWorst: { en: 'Worst Elo', fr: 'Pire ELO' },
        dbKeyBest: 'elo',
        dbKeyWorst: 'elo',
        orderBest: 'desc',
        orderWorst: 'asc',
    },
    {
        icon: 'barbell.png',
        titleBest: { en: 'Most wins', fr: 'Plus de victoires' },
        titleWorst: { en: 'Most losses', fr: 'Plus de défaites' },
        dbKeyBest: 'n_victories',
        dbKeyWorst: 'n_defeats',
        orderBest: 'desc',
        orderWorst: 'desc',
    },
    {
        icon: 'run.png',
        titleBest: { en: 'Longest win streak', fr: 'Plus longue série de victoires' },
        titleWorst: { en: 'Longest losing streak', fr: 'Plus longue série de défaites' },
        dbKeyBest: 'largest_win_streak',
        dbKeyWorst: 'largest_loosing_streak',
        orderBest: 'desc',
        orderWorst: 'desc',
    },
    {
        icon: 'aim.png', //'🧗'
        titleBest: { en: 'Most points scored', fr: 'Plus de points marqués' },
        titleWorst: { en: 'Fewest points scored', fr: 'Moins de points marqués' },
        dbKeyBest: 'n_points_scored',
        dbKeyWorst: 'n_points_scored',
        orderBest: 'desc',
        orderWorst: 'asc',
    },
    {
        icon: 'shield.png',
        titleBest: { en: 'Fewest points conceded', fr: 'Moins de points concédés' },
        titleWorst: { en: 'Most points conceded', fr: 'Plus de points concédés' },
        dbKeyBest: 'n_points_conceded',
        dbKeyWorst: 'n_points_conceded',
        orderBest: 'asc',
        orderWorst: 'desc',
    },
    {
        icon: 'swim.png', //'🧗
        titleBest: {
            en: `Most days spent in the ${LeagueDisplayNames[LeagueNames[LeagueNames.length - 1]].en} league`,
            fr: `Plus de jours passés dans la ligue ${LeagueDisplayNames[LeagueNames[LeagueNames.length - 1]].fr}`,
        },
        titleWorst: {
            en: `Most days spent in the ${LeagueDisplayNames[LeagueNames[0]].en} league`,
            fr: `Plus de jours passés dans la ligue ${LeagueDisplayNames[LeagueNames[0]].fr}`,
        },
        dbKeyBest: 'n_days_in_best_league',
        dbKeyWorst: 'n_days_in_worst_league',
        orderBest: 'desc',
        orderWorst: 'desc',
    }
];

CustomStatsInfos.forEach((info) => {
    if (info.in_palmares) {
        const enTitle = info.title?.en ?? info.title;
        const frTitle = info.title?.fr ?? info.title;
        const enFewTitle = `Fewest ${enTitle}`;
        const enMostTitle = `Most ${enTitle}`;
        const frFewTitle = `Le moins de ${frTitle}`;
        const frMostTitle = `Le plus de ${frTitle}`;
        PalmaresInfo.push({
            icon: info.palmares_image,
            titleBest: {
                en: info.to_maximize ? enMostTitle : enFewTitle,
                fr: info.to_maximize ? frMostTitle : frFewTitle,
            },
            titleWorst: {
                en: info.to_maximize ? enFewTitle : enMostTitle,
                fr: info.to_maximize ? frFewTitle : frMostTitle,
            },
            dbKeyBest: info.key,
            dbKeyWorst: info.key,
            valueLabel: info.description,
            orderBest: info.to_maximize ? 'desc' : 'asc',
            orderWorst: info.to_maximize ? 'asc' : 'desc',
            custom_stats: true,
        });
    }
});

export const StatsInfos = [
    {
        key: 'elo',
        title: { en: 'Peak ELO', fr: 'ELO maximal' },
        value_key: 'peak_elo',
    },
    {
        key: 'win_streak',
        title: { en: 'Win streak', fr: 'Série de victoires' },
        value_key: 'largest_win_streak',
    },
    {
        key: 'n_victories',
        title: { en: 'Wins', fr: 'Victoires' },
        value_key: 'n_victories',
    },
    {
        key: 'n_defeats',
        title: { en: 'Losses', fr: 'Défaites' },
        value_key: 'n_defeats',
    },
];

CustomStatsInfos.forEach((info) => {
    if (info.in_palmares) {
        StatsInfos.push({
            'key': info.key,
            'title': info.title,
            'value_key': info.key,
            'custom_stat': true
        });
    }
});
