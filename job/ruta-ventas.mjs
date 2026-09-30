// Shop Sales Query New, copiado del paquete de la pantalla
// (assets/index-dbd8ad04.js + salesManagement). Sin tokens.
//
// La pantalla pide el Excel con exportApi y después consulta la tarea.
// La lista JSON es la misma vista, pero el pegado usa el Excel para
// conservar el orden de columnas (Shop ID en Y1 hasta Model Type-Finance).

export const SALES_EXPORT_URL =
  "https://pfgateway.transsion.com/dcr-file-download/api/excel/holo/salesReportWideExport";

export const SALES_LIST_URL =
  "https://pfgateway.transsion.com/dcr-file-service/stock/out/report/holo/salesReport/listPg";

export const SALES_COUNT_URL =
  "https://pfgateway.transsion.com/dcr-file-service/stock/out/report/holo/salesReport/count";

export const EXPORT_TASK_LIST_URL =
  "https://hk-paas.transsion.com/mkt-file-service/export/task/list";

export const LOGIN_URL = "https://dcr.imwav.com/login#/";

// Cuerpo que arma getExportParams: el formulario de la pantalla, con las
// listas partidas y las fechas del ciclo en carga y en venta.
export function cuerpoVentas(ciclo) {
  return {
    areaId: "",
    areaName: "",
    regionId: "",
    shopCodes: [],
    brands: [],
    models: [],
    items: [],
    marketingNames: [],
    fpSp: "",
    series: [],
    codes: [],
    submitterCodes: [],
    submitterDutyIds: [],
    startDate: ciclo.inicio,
    endDate: ciclo.hasta,
    startSalesDate: ciclo.inicio,
    endSalesDate: ciclo.hasta,
    startActivationDate: "",
    endActivationDate: "",
    countries: [],
    activationCountryList: [],
    deliveryCountryList: [],
    modelTypeList: [],
    incentiveStatus: "",
    manpowerTypeCodes: [],
    shopImage: "",
    collectTypeCode: "",
    cityTiry: "",
    achieveStatus: null,
    staffAchieveStatus: null,
    enabledFlag: 1,
    bookingActivityIds: [],
    colors: [],
    supplierIds: [],
    categorys: [],
    manualValidateStatus: "",
    validateStatus: "",
    shopTypeCode: "",
    fakeStatus: "",
  };
}

export const COLUMNAS_ESPERADAS = {
  0: "Shop ID",
  4: "Sales Date",
  16: "Model",
  24: "IMEI/SN",
  33: "Activation Date",
  53: "State",
  54: "City",
  62: "Uploader ID",
  63: "Uploader",
  102: "Model Type-Finance",
};

export const COLUMNAS_OCULTAS = new Set([
  "IMEI/SN",
  "IMEI/SN List",
  "IMEI Picture",
  "Consumer Phone",
  "Consumer Name",
  "Consumer Mail",
]);
