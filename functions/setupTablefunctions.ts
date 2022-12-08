import prisma from "../prisma/client";
const { NumberPrompt } = require("enquirer");
import { mainPrompt } from "../mainPrompts";

export function setupPrompt() {
  //controls the scripting in this page "columnfunctions"
  const prompt = new NumberPrompt({
    name: "number",
    message: "Please enter the number for your selection",
  });

  console.log("Please enter one of the following options");
  console.log(
    "0...Setup distinct tables for account/token, also lookup price histories"
  );
  console.log("1...internal/ external & buy / sell");
  console.log("2...");
  console.log("3...");
  console.log("4...");
  console.log("5...");
  console.log("9...back");

  prompt.run().then(function (answer) {
    if (answer === 0) {
      answer = null;
      generateListingToken().catch((e) => {
        console.error(e);
        process.exit(1);
      });
      generateListingAccount().catch((e) => {
        console.error(e);
        process.exit(1);
      });
      lookupOldDECPriceHistory().catch((e) => {
        console.error(e);
        process.exit(1);
      });
      lookupNewDECPriceHistory().catch((e) => {
        console.error(e);
        process.exit(1);
      });
      lookupCreditsPriceHistory().catch((e) => {
        console.error(e);
        process.exit(1);
      });
      lookupSPSPriceHistory().catch((e) => {
        console.error(e);
        process.exit(1);
      });
      lookupVoucherPriceHistory().catch((e) => {
        console.error(e);
        process.exit(1);
      });
    }

    if (answer === 1) {
      answer = null;

      updateBuySellColumn();
    }

    if (answer === 9) {
      answer = null;
      mainPrompt();
    }
  });
}

async function generateListingToken() {
  //generate table that lists all of the distinct tokenss and put into the "Listing_Table" table in the database...this table is utilized to calc FIFO
  const distinctAccount = await prisma.sPL.findMany({
    select: {
      Token: true,
    },
    distinct: ["Token"],
  });
  await prisma.listing_Token.createMany({
    data: distinctAccount,
  });
}

async function generateListingAccount() {
  /*
    generate table that lists all of the distinct 
    accounts and put into the "Listing_Account" 
    table in the database, which is used to determine what
    is internal vs. external...see columnFunctions.ts
  */

  const distinctAccount = await prisma.sPL.findMany({
    select: {
      Account: true,
    },
    distinct: ["Account"],
  });
  await prisma.listing_Account.createMany({
    data: distinctAccount,
  });
}

async function lookupOldDECPriceHistory() {
  console.log("do i do anything?");
  /*

      this function place the price of a token into the appropriate line 
      for a given Crypto transation on the SPL table,
      it looks up the Price from the
      "history_price_XXX" tables.
    */

  /*
     I have "crypto" data that begins before my historical data
      For DEC token i declare a fixed number later, based on the earilest date
      that I have data for (from yahoo) (8/10/2020)
   */

  let firstDecPrice = new Date(2020, 7, 10);
  console.log("🌟🌟🌟 starting lookup of older DEC prices", firstDecPrice);

  /*
     i update the prices for all tranactions
     that I have no data for below, 
     before this date (approx) in game currency
     was not on the blockchain and had 
     no value
    */

  await prisma.sPL.updateMany({
    where: {
      Token: "DEC",
      Created_Date: {
        lte: firstDecPrice,
      },
    },
    data: {
      Price: 0.0,
    },
  });

  console.log("👍👍👍lookup of older DEC prices complete");
}

async function lookupCreditsPriceHistory() {
  console.log("🌟🌟🌟 starting lookup of CREDIT prices");
  /*
      credits for the most part cost
      $1 for 1000 Credits
    */
  let tokenCName = "CREDITS";
  let CreditPrice = 0.001;

  await prisma.sPL.updateMany({
    where: {
      Token: tokenCName,
    },
    data: {
      Price: CreditPrice,
    },
  });

  /*
       Calculate the USD equivalent price of the token,
       must be run after calcDeclookup, calcSPSlookup.
      */
  const calcUSD = await prisma.sPL.findMany({
    where: {
      Token: tokenCName,
    },
    select: {
      id: true,
      Amount: true,
      Price: true,
    },
  });

  let usdOfElement = 0.0;
  for (let element of calcUSD) {
    usdOfElement = Number(element.Amount) * Number(element.Price);
    await prisma.sPL.update({
      where: {
        id: element.id,
      },
      data: {
        inUSD: usdOfElement,
      },
    });

    if (element.id % 10000 === 0) {
      console.log("processed through ", element.id);
    }
  }

  console.log("👍👍👍 Credit lookup and USD complete");
}

async function lookupSPSPriceHistory() {
  console.log("🌟🌟🌟 starting lookup of SPS prices");

  /*
     I have data that begins before my historical data For
      SPS token i declar a token price so I can define it as a fixed number
       later (7/26/2021) 
    */

  let firstSPSPrice = new Date(2021, 6, 26);

  /* i update the prices for all tranactions that 
    I have no data for below, this number or assumption 
    could be wrong talk to Jesse */

  await prisma.sPL.updateMany({
    where: {
      Token: "SPS",
      Created_Date: {
        lte: firstSPSPrice,
      },
    },
    data: {
      Price: 0.0,
    },
  });

  const updateSPLwithFindPriceSPS = await prisma.sPL.findMany({
    where: {
      Token: "SPS",
      Created_Date: {
        gt: firstSPSPrice,
      },
    },
    select: {
      id: true,
      Created_Date: true,
    },
    //take: 1,
  });

  for (let element of updateSPLwithFindPriceSPS) {
    let strmonth = "";
    let strDayOfMonth = "";

    /*
        this if controls logic for findinf prices of the SPS token that I have found in yahoo finance, note all data is after (7/26/2021) 
       https://finance.yahoo.com/quote/SPS-USD/history?period1=1508284800&period2=1666051200&interval=1d&filter=history&frequency=1d&includeAdjustedClose=true
      */

    let elementDate = element.Created_Date;
    let dayofMonth = elementDate.getUTCDate();
    let month = elementDate.getUTCMonth();
    let year = elementDate.getUTCFullYear();
    month++;

    //handle the use case that day 1 - 9, needs to return 01 - 09
    if (month <= 9) {
      strmonth = "0" + month.toString();
    }

    if (month > 9) {
      strmonth = month.toString();
    }

    if (dayofMonth <= 9) {
      strDayOfMonth = "0" + dayofMonth.toString();
    }

    if (dayofMonth > 9) {
      strDayOfMonth = dayofMonth.toString();
    }

    let dateStr =
      year + "-" + strmonth + "-" + strDayOfMonth + "T00:00:00+00:00";

    const lookupPricebyDate = await prisma.history_price_SPS.findMany({
      where: {
        Asset: "SPS",
        Date: dateStr,
      },
      select: {
        id: true,
        Date: true,
        Close: true,
      },
    });

    /*loop through all the elements in this array updateSPLwithFindPriceSPS who's purpose is to find all the data that will have price data that I can find and update the data line with the closing price for that day */

    await prisma.sPL.update({
      where: {
        id: element.id,
      },
      data: {
        Price: lookupPricebyDate[0].Close,
      },
    });
  }

  /*
     Calculate the USD equivalent price of the token,
     must be run after calcDeclookup, calcSPSlookup.
    */
  const calcUSD = await prisma.sPL.findMany({
    where: {
      Token: "SPS",
    },
    select: {
      id: true,
      Amount: true,
      Price: true,
    },
  });
  let usdOfElement = 0.0;
  for (let element of calcUSD) {
    usdOfElement = Number(element.Amount) * Number(element.Price);
    await prisma.sPL.update({
      where: {
        id: element.id,
      },
      data: {
        inUSD: usdOfElement,
      },
    });
  }
  console.log("👍👍👍 SPS lookup and USD calc complete");
}

async function lookupVoucherPriceHistory() {
  // varibles for use in this function
  let myAsset = "VOUCHER";

  //first date is 10, java script starts at 0 so 9 instead
  let firstPrice = new Date(2021, 9, 18);

  console.log(`🌟🌟🌟 starting lookup of ${myAsset} at ${firstPrice}`);
  /*
      this function place the price of a token into the appropriate line 
      for a given Crypto transation on the SPL table,
      it looks up the Price from the
      "history_price_XXX" tables.
    */

  /*
     I have "crypto" data that begins before my historical data
      For Voucher token i declare a fixed number later, based on the earilest date
      that I have data for (from REAZ) (10/18/2021)
   */

  /*
     i update the prices for all tranactions
     that I have no data for below, 
     before this date (approx) in game currency
     was not on the blockchain and had 
     no value
    */

  await prisma.sPL.updateMany({
    where: {
      Token: myAsset,
      Created_Date: {
        lte: firstPrice,
      },
    },
    data: {
      Price: 0.0,
    },
  });

  //this code section updates the prices for any date after the first price date.. Meaning A price exist and can be found online, before (8/10/2020) no data seems to exist
  const updateSPLwithFindPriceCredit = await prisma.sPL.findMany({
    where: {
      Token: myAsset,
      Created_Date: {
        gt: firstPrice,
      },
    },
    select: {
      id: true,
      Created_Date: true,
    },
    //if you want to run a smaller sample uncomment next line
    //take: 1,
  });

  for (let element of updateSPLwithFindPriceCredit) {
    let strmonth = "";
    let strDayOfMonth = "";

    /*
       this if controls logic for findinf prices of the DEC
        token that I have found in yahoo finance, note all data is after
        (10/18/2021)
        
      */

    let elementDate = element.Created_Date;
    let dayofMonth = elementDate.getUTCDate();
    let month = elementDate.getUTCMonth();
    let year = elementDate.getUTCFullYear();
    month++;

    //handle the use case that day 1 - 9, needs to return 01 - 09
    if (month <= 9) {
      strmonth = "0" + month.toString();
    }

    if (month > 9) {
      strmonth = month.toString();
    }

    if (dayofMonth <= 9) {
      strDayOfMonth = "0" + dayofMonth.toString();
    }

    if (dayofMonth > 9) {
      strDayOfMonth = dayofMonth.toString();
    }

    let dateStr =
      year + "-" + strmonth + "-" + strDayOfMonth + "T00:00:00+00:00";

    const lookupPricebyDate = await prisma.history_price_Voucher.findMany({
      where: {
        Asset: myAsset,
        Date: dateStr,
      },
      select: {
        id: true,
        Date: true,
        price_usd: true,
      },
    });

    // console.log(element, "datestr..", dateStr, "..day o m..", dayofMonth);

    /*
      loop through all the elements in this array
      updateSPLwithFindPriceCredit who's purpose is to find all 
      the data that will have price data that I can find and 
      update the data line with the closing price for that day 
    */

    await prisma.sPL.update({
      where: {
        id: element.id,
      },
      data: {
        Price: lookupPricebyDate[0].price_usd,
      },
    });
  }

  /*
       Calculate the USD equivalent price of the token,
       must be run after calcDeclookup, calcSPSlookup.
      */
  const calcUSD = await prisma.sPL.findMany({
    where: {
      Token: myAsset,
    },
    select: {
      id: true,
      Amount: true,
      Price: true,
    },
  });

  let usdOfElement = 0.0;
  for (let element of calcUSD) {
    usdOfElement = Number(element.Amount) * Number(element.Price);
    await prisma.sPL.update({
      where: {
        id: element.id,
      },
      data: {
        inUSD: usdOfElement,
      },
    });

    if (element.id % 10000 === 0) {
      console.log("processed through ", element.id);
    }
  }

  console.log(`👍👍👍 ${myAsset} lookup and USD complete`);
}

async function lookupNewDECPriceHistory() {
  console.log("🌟🌟🌟 starting lookup of DEC prices");
  /*
    this function place the price of a token into the appropriate line 
    for a given Crypto transation on the SPL table,
    it looks up the Price from the
    "history_price_XXX" tables.
  */

  /*
   I have "crypto" data that begins before my historical data
    For DEC token i declare a fixed number later, based on the earilest date
    that I have data for (from yahoo) (8/10/2020)
 */

  let firstDecPrice = new Date(2020, 7, 10);

  //this code section updates the prices for any date after the first price date.. Meaning A price exist and can be found online, before (8/10/2020) no data seems to exist
  const updateSPLwithFindPriceDEC = await prisma.sPL.findMany({
    orderBy: {
      id: "asc",
    },
    where: {
      Token: "DEC",
      Created_Date: {
        gt: firstDecPrice,
      },
    },
    select: {
      id: true,
      Created_Date: true,
    },
    //if you want to run a smaller sample uncomment next line
    //take: 1,
  });

  for (let element of updateSPLwithFindPriceDEC) {
    let strmonth = "";
    let strDayOfMonth = "";

    /*
     this if controls logic for findinf prices of the DEC
      token that I have found in yahoo finance, note all data is after
       (8/10/2020)
        https://finance.yahoo.com/quote/DEC1-USD/history?period1=1594598400&period2=1666051200&interval=1d&filter=history&frequency=1d&includeAdjustedClose=true

    */

    let elementDate = element.Created_Date;
    let dayofMonth = elementDate.getUTCDate();
    let month = elementDate.getUTCMonth();
    let year = elementDate.getUTCFullYear();
    month++;

    //handle the use case that day 1 - 9, needs to return 01 - 09
    if (month <= 9) {
      strmonth = "0" + month.toString();
    }

    if (month > 9) {
      strmonth = month.toString();
    }

    if (dayofMonth <= 9) {
      strDayOfMonth = "0" + dayofMonth.toString();
    }

    if (dayofMonth > 9) {
      strDayOfMonth = dayofMonth.toString();
    }

    let dateStr =
      year + "-" + strmonth + "-" + strDayOfMonth + "T00:00:00+00:00";

    const lookupPricebyDate = await prisma.history_price_DEC.findMany({
      where: {
        Asset: "DEC",
        Date: dateStr,
      },
      select: {
        id: true,
        Date: true,
        Close: true,
      },
    });
    if (element.id % 1000 === 0) {
      console.log("processed through #Dec Transactions ", element.id);
    }

    //   /*
    //   loop through all the elements in this array
    //   updateSPLwithFindPriceCredit who's purpose is to find all
    //   the data that will have price data that I can find and
    //   update the data line with the closing price for that day
    //   */

    await prisma.sPL.update({
      where: {
        id: element.id,
      },
      data: {
        Price: lookupPricebyDate[0].Close,
      },
    });
  }
  calcDecUSD();
}

async function calcDecUSD() {
  console.log("calc DEC usd started");
  /*
     Calculate the USD equivalent price of the token,
     must be run after calcDeclookup, calcSPSlookup.
    */
  const calcUSD = await prisma.sPL.findMany({
    where: {
      Token: "DEC",
    },
    select: {
      id: true,
      Amount: true,
      Price: true,
    },
  });

  let usdOfElement = 0.0;
  for (let element of calcUSD) {
    if (element.id % 1000 === 0) {
      console.log("processed through #calc USD Dec Transactions ", element.id);
    }
    usdOfElement = Number(element.Amount) * Number(element.Price);
    await prisma.sPL.update({
      where: {
        id: element.id,
      },
      data: {
        inUSD: usdOfElement,
      },
    });

    if (element.id % 1000 === 0) {
      console.log("processed through ", element.id);
    }
  }
  console.log("Calc DEC complete");
}

async function updateBuySellColumn() {
  //updates the buy or sell column in the SPL database for FIFO calc purposes in === Buy out === Sell
  console.log("🌟🌟🌟 starting buy/sell script");

  await prisma.sPL.updateMany({
    where: {
      Amount: {
        gt: 0,
      },
    },
    data: {
      Buy_or_Sell: "Buy",
    },
  });

  await prisma.sPL.updateMany({
    where: {
      Amount: {
        lte: 0,
      },
    },
    data: {
      Buy_or_Sell: "Sell",
    },
  });

  console.log("👍👍👍 buy/sell column complete");
}

async function internalExternalColumn() {
  /*
    generate table that lists all of the distinct 
    accounts and put into the "Listing_Account" 
    table in the database, which is used to determine what
    is internal vs. external...see columnFunctions.ts
  */

  const findInternalTransactions = await prisma.listing_Account.findMany({
    select: {
      Account: true,
    },
  });

  let myArrayforInternal = [];

  findInternalTransactions.forEach((element) => {
    myArrayforInternal.push(element.Account);
  });

  await prisma.sPL.updateMany({
    where: {
      From: {
        in: myArrayforInternal,
      },
    },
    data: {
      Internal_or_External: "Internal",
    },
  });

  await prisma.sPL.updateMany({
    where: {
      NOT: {
        From: {
          in: myArrayforInternal,
        },
      },
    },
    data: {
      Internal_or_External: "External",
    },
  });

  console.log("👍👍👍 internal/external column complete");
}
