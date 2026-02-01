import emv from 'node-emv';

export const toByteArray = (text: string) => {
    return text.match(/.{1,2}/g)?.map((b) => {
        return parseInt(b, 16);
    }) || [];
};

export const toHexString = (byteArr: number[]) => {
    return byteArr.reduce((acc, byte) => {
        return acc + ('00' + byte.toString(16).toUpperCase()).slice(-2);
    }, '');
};

export const getEmvInfo = (info: string): Promise<any> => {
    return new Promise((resolve) => {
        // @ts-ignore
        emv.describe(info, (data) => {
            if (data) {
                resolve(data);
            } else {
                resolve(null);
            }
        });
    });
};

export const getCardInfoVisa = (responses: any) => {
    let res;
    let end = false;
    // Use a recursive search or flat search if the structure is known. 
    // Based on the user provided snippet which iterates response looking for tags
    // We need to inspect the parsed EMV structure which node-emv returns.
    // The user snippet assumes 'responses' is the PARSED structure from getEmvInfo?
    // Actually the user snippet logic is:
    /*
      const emvData = await getEmvInfo(toHexString(responses[2])); // responses[2] is the raw APDU response
      const cardInfo = getCardInfoVisa(emvData);
    */
    // So 'emvData' is the input to getCardInfoVisa. node-emv 'describe' returns an array of objects usually.

    if (!responses || !Array.isArray(responses)) return null;

    for (let i = 0; i < responses.length; i++) {
        const r = responses[i];
        if (r.tag === '77' && r.value && r.value.length > 0) { // Response Message Template Format 2
            for (let j = 0; j < r.value.length; j++) {
                const e = r.value[j];
                if (e.tag === '57' && e.value) { // Track 2 Equivalent Data
                    const parts = e.value.split('D'); // 'D' is separator in Track 2
                    if (parts.length > 1) {
                        res = {
                            card: parts[0],
                            exp: parts[1].substring(0, 4),
                        };
                        end = true;
                    }
                }
                if (end) break;
            }
            if (end) break;
        }
    }
    return res;
};

export const formatCardExp = (exp: string) => {
    if (!exp || exp.length !== 4) return exp;
    return `${exp.substring(2, 4)}/${exp.substring(0, 2)}`; // YYMM -> MM/YY usually? Or just format as is. 
}
