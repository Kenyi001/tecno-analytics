// Shop Stock In Record New. Copiado de assets/index-4d63a8df.js
// y assets/warehouse-e78e394b.js. Sin tokens.
//
// La lista es holo/listPg. El Excel es Purchase/holo/query.
// Sin modelos: es la base que reemplaza Datos.
// Con LK7 y LK7K: solo se compara el corte, no se pega.

export const STOCK_LIST_URL =
  "https://pfgateway.transsion.com/dcr-file-service/stock/in/record/report/holo/listPg";

export const STOCK_EXPORT_URL =
  "https://pfgateway.transsion.com/dcr-file-download/api/excel/shop/Purchase/holo/query";

export function cuerpoStock(modelos = []) {
  return {
    firstCategory: "",
    submitterCode: "",
    fpSp: "",
    startInboundTime: "",
    endInboundTime: "",
    startActivationDate: "",
    endActivationDate: "",
    supplierIds: [],
    models: modelos,
    codes: [],
    brands: [],
    items: [],
    areaId: null,
    status: "",
    shopCodeList: [],
    publicCodeList: [],
    subDealerIdList: [],
    marketNameList: [],
    manpowerTypeCodes: [],
    countryList: [],
    activationCountryList: [],
    deliveryCountryList: [],
    enterpriseCode: "",
    source: null,
    enterpriseCodeList: [],
    startDate: "",
    endDate: "",
    validateStatus: "",
    manualValidateStatus: "",
    fakeStatus: "",
  };
}
