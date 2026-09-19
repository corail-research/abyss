export default {
    locales: [
        "en",
        "fr"
    ],
    extract: {
        input: "src/**/*.{js,jsx,ts,tsx}",
        output: "public/locales/{{language}}/{{namespace}}.json"
    }
}
