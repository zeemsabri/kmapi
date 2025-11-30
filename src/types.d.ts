declare module 'vcard-parser' {
    const vCardParser: {
        parse: (vcardString: string) => any;
    };
    export default vCardParser;
}
