// --- Constant Definition ---
const sigma = 5.67 * Math.pow(10,-8); // Boltzman Constant
//---Astronomy-Specific-Constants
const perihelion = 2; //The day in January of the perihelion, used for distance calculation
const ast_a = 1.496 * Math.pow(10,11); //Earth's semi-major axis
const ast_e = .0167; //Earth's eccentricity
const airTemp = 294.25; // Air temperature at the time of capture
const heightGround = .1; //m
const heightAir = 200; //m
const windSpeed = 3.6; //m/s
const heightWindSensor = 2; //m
const plantHeightAvg = 2; //m
const airDensity = .08163; //kg/m^3
const zenithAngle = .4337;
const thermalMapping = [299.1,315.1];
const imageDimensions = [3539,4165];

// --- Image filenames ---
let rgbImageFilename = 'RGBoutput2.jpg';
let compositeImageFilename = 'composite2.jpg';
let netRadiationImageFilename = 'RnImage.jpg';
let soilFluxImageFilename = 'SoilFlux.jpg';
let thermalImageFilename = 'thermalImg.jpg';
let sensHeatFluxFilename = 'sensHeatFlux.jpg';
let soilSaturationFilename = 'soilSat.jpg';

// ---------- Predeclaration ----------
let tedData;
let frictionVelocityU;
let imageArray = [];
let imgW;
let imgH;
let checker = [false,false,false,false,false,false];


// --- Temporary Globals ---
let tempNirNir;
let tempThermal;
let tempNirReds;

// --- Preloaded images ---
let nearInfared;
let rgb;
let netRadiationImageRn;
let soilFluxImageG;
let thermalImageImp;
let sensibleHeatFluxImage;
let imageImportArray = [];


// --- Tensors and p5 Images ---
let nirImage;
let thermalImage;
let ndviImage;
let soilImage;
let rnImage;
let soilFluxImage;
let frictionVelocityU200;
let groundRoughnessRah;
let sensibleHeatFluxH;
let moninObukhovLengthL;
let soilSaturationImage;
let psiHg;
let psiHs;
let psiM;
let ndvi;
let savi;
let lai;
// ------------------------------------
// ---------- Misc Geo Data -------------
class GeoData{
  constructor(date){
    let doy = date.getDOY();
    this.solarDeclination = -1 * Math.asin(.39779 * Math.cos(.98565 * (doy + 10) + 1.914 * Math.sin(.98565 * (doy - 2))));
    this.solarDistance = (ast_a * (1-Math.pow(ast_e,2)))/(1+(ast_e * Math.cos((365.25/360) * (doy-perihelion))))/(1.496*Math.pow(10,11));
    this.atmTrans = .75 + 2*Math.pow(10,-5)*1511;
    this.solarIncidence = zenithAngle;
    this.temperature = airTemp;
    this.atmosEmiss = .85 * Math.pow(-1 * Math.log(this.atmTrans),.09);
  }
  solarIncToTensor(){
    return tf.scalar(this.solarInclination);
  }
  solarDistToTensor(){
    return tf.scalar(this.solarDistance);
  }
  solarAtmTransToTensor(){
    return tf.scalar(this.atmTrans);
  }
  solarIncToTensor(){
    return tf.scalar(this.solarIncidence);
  }
  atmosEmissToTensor(){
    return tf.scalar(this.atmosEmiss);
  }
}
// ------------------------------------
// ---------- Support Functions ----------
// --- Returns a p5 image ---
const makeImage = (w,h,pixArr) => {
  let tempImage = createImage(w,h);
  for(let y=0;y<imgH;y++){
    for(let x=0;x<imgW;x++){
      tempImage.set(x,y,pixArr[x+y*w]);
    }
  }
  tempImage.updatePixels();
  return tempImage;
}
// --- Maps a tensor from range [oldMin,oldMax] to new range [newMin,newMax] ---
const mapTensor = (tensor,oldMin,oldMax,newMin,newMax) => tensor.sub(oldMin).mul(newMax-newMin).div(oldMax-oldMin).add(newMin);
// --- Collects imported images for validation ---
const appendImageArr = (id,name,good,crit = false) => {
  imageImportArray[id] = ({name:name,success:good});
  if(good){
    checker[id] = true;
    console.log(`${name} imported successfully!`);
  }else{
    checker[id] = false;
    if(crit) console.error(`${name} not found, but is necessary.  Stopping,`);
    else console.log(`${name} not found, skipping.`);
  }
};
// --- Draws the collected images onto the canvas consecutively ---
const drawNextImage = frame => image(imageArray[frame%imageArray.length],0,0,(imgH>=imgW)?(imgW*windowHeight)/imgH:windowWidth,(imgH<=imgW)?(imgH*windowWidth)/imgW:windowHeight);
// --- Collects the created images into an array for display ---
const addImages = imgs => imgs.forEach(c => imageArray.push(c));
// --- Checker than ensures that the image being called has been imported ---
const checkRequirements = range => {
  let tempCheck = true;
  checker.forEach((c,i) => {
    if(i >= range[0] && i <= range[1]){
      if(!c) tempCheck = false;
    }
  });
  return tempCheck;
}
// --- Extends the date class to determine if the inputted year is a leap year ---
Date.prototype.isLeapYear = function() {
    var year = this.getFullYear();
    if((year & 3) != 0) return false;
    return ((year % 100) != 0 || (year % 400) == 0);
};
// --- Extends the date class to determine get the day of the year based on the inputted date ---
Date.prototype.getDOY = function() {
    var dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var mn = this.getMonth();
    var dn = this.getDate();
    var dayOfYear = dayCount[mn] + dn;
    if(mn > 1 && this.isLeapYear()) dayOfYear++;
    return dayOfYear;
};
// ------------------------------------
// --- Pre-Initialization Asset Fetching---
function preload(){
  nearInfared = loadImage(compositeImageFilename, () => appendImageArr(0,"Composite Image",true), () => appendImageArr(0,"Composite Image",false,true));
  rgb = loadImage(rgbImageFilename, () => appendImageArr(1,"RGB Image",true), () => appendImageArr(1,"RGB Image",false,true));
  //netRadiationImageRn = loadImage(netRadiationImageFilename, () => appendImageArr(2,"Net Radiation Image",true), () => appendImageArr(2,"Net Radiation Image",false,false));
  //soilFluxImageG = loadImage(soilFluxImageFilename, () => appendImageArr(3,"Soil Flux Image",true), () => appendImageArr(3,"Soil Flux Image",false,false));
  //thermalImageImp = loadImage(thermalImageFilename, () => appendImageArr(4,"Thermal Image",true), () => appendImageArr(4,"Thermal Image",false,false));
  //sensibleHeatFluxImage = loadImage(sensHeatFluxFilename, () => appendImageArr(5,"Sensible Heat Flux",true), () => appendImageArr(4,"Sensible Heat Flux",false,false));
}

// --- p5 Initialization ---
function setup() {
  tedData = new GeoData(new Date('October 10, 2018'));

  if(!(nearInfared === undefined)){
    imgW = nearInfared.width;
    imgH = nearInfared.height;
  }else{
    imgW = imageDimensions[0];
    imgH = imageDimensions[1];
  }

  createCanvas(windowWidth,windowHeight);

  // --- TensorFlow Garbage Collect ---
  tf.tidy(() => {
    // - Require at both a composite image and an rgb image -
    if(!checkRequirements([0,1])) {
      console.error("Must have at least an RGB image, and a composite image where the Red channel contains the red values, the green channel contains the thermal bands, and the blue channel contains the near-infared band.");
      noLoop();
      // - If the Rn, G, and Thermal images aren't provided, make them -
    }else if(checkRequirements([0,1]) && !checkRequirements([2,4])){
      // --- Inputs ---
      tempNirReds = [];
      tempThermal = [];
      tempNirNir = [];

      nearInfared.loadPixels();

      nearInfared.pixels.forEach((c,i) => {
        if(i%4 == 0) tempNirReds[i/4] = c; // The red pixels go to the red temporary array
        else if(i%4 == 1) tempNirNir[(i-1)/4] = c; // The greens (or near infared band) go to nir temporary array
        else if(i%4 == 2) tempThermal[(i-2)/4] = c; // The blues (or thermal band) go to thermal array
      });

      let tempAlbedo = [];
      // --- Assign albedo Pixels ---
      rgb.loadPixels();
      rgb.pixels.forEach((c,i) => {
        tempAlbedo[i] = c;
      });
      // --------------

    // --- Processing ---
     let redsTensor = tf.tensor(tempNirReds,[imgW,imgH]); // The red values
     let nirTensor = tf.tensor(tempNirNir,[imgW,imgH]); // The NIR Values
     let rgbTensor = tf.tensor(tempAlbedo,[imgW,imgH,4]); // A tensor of RGB Values

    tempNirReds = null;
    tempNirNir = null;
    tempAlbedo = null;

     ndvi = nirTensor.sub(redsTensor).div(nirTensor.add(redsTensor)); // Normalized-Difference Vegetation Index
     savi = nirTensor.sub(redsTensor).mul(1.1).div(nirTensor.add(redsTensor).add(.1)); // Soil Adjusted Vegitation Index
     lai = savi.mul(-1).add(.69).div(.59).log().div(.91).mul(-1); // Leaf area index

       console.log("--Sample NDVI (from grass):");
       console.log(ndvi.dataSync()[2136+919*imgW]);
       console.log("--Sample SAVI (from grass):");
       console.log(savi.dataSync()[2136+919*imgW]);
       console.log("--Sample LAI (from grass):");
       console.log(lai.dataSync()[2165+919*imgW]);

      let tempLai = lai.dataSync();
      let tempEmiss = [];
      tempLai.forEach(c => {
        tempEmiss.push((c<3)?c*.01+.95:.98);
      });

     let emissivity = tf.tensor(tempEmiss,[imgW,imgH]); // Surface Emissivity
       console.log("--Sample Emissivity (from grass):");
       console.log(emissivity.dataSync()[2165+919*imgW]);
          tempEmiss = null;
          tempLai = null;

    let thermalTensor = mapTensor(tf.tensor(tempThermal,[imgW,imgH]),0,255,thermalMapping[0],thermalMapping[1]).pow(4).sub(emissivity.mul(-1).add(1).mul(Math.pow(tedData.temperature,4))).div(emissivity).pow(.25); // Maps Thermal Values to Kelvin Temperatures
      console.log("--Sample Thermal Measurements (from grass):");
      console.log(thermalTensor.dataSync()[2165+919*imgW]);
        tempThermal = null;

    const solarInc = tedData.solarIncToTensor(); // Solar Incidence
      console.log("--Solar Incidence:");
      solarInc.print();

    const solarDist = tedData.solarDistToTensor(); // Distance from sun
      console.log("--Solar Distance:");
      solarDist.print();

    const atmTransTens = tedData.solarAtmTransToTensor(); // Atmosphereic Transmisivity
      console.log("--Atmospheric Transmisivity:");
      atmTransTens.print();

    const incomingShortwave = solarDist.reciprocal().pow(2).mul(solarInc.cos()).mul(1367).mul(atmTransTens); // Incoming shortwave radiation
      console.log("--Incoming Shortwave Radiation:");
      incomingShortwave.print();

    const incomingLongwave = tf.scalar(Math.pow(tedData.temperature,4)*5.6*Math.pow(10,-8)).mul(tedData.atmosEmissToTensor()); // Incoming longwave radiation
      console.log("--Incoming Longwave Radiation:");
      incomingLongwave.print();

      let [rgbRTensor,rgbGTensor,rgbBTensor,rgbATensor] = tf.split(rgbTensor,4,2); // Seperate tensors with red-blue-green values
      let reds = tf.squeeze(rgbRTensor);
      let greens = tf.squeeze(rgbGTensor);
      let blues = tf.squeeze(rgbBTensor);
      let albedo = tf.squeeze(reds.add(greens).add(blues).div(incomingShortwave)); // albedo or surface reflectance
        console.log("--Albedo:");
        console.log(albedo.dataSync()[2165+919*imgW]);
          tf.dispose([redsTensor,rgbTensor,rgbRTensor,rgbGTensor,rgbBTensor,rgbATensor,reds,greens,blues]);

     const outgoingLongwave = thermalTensor.pow(tf.scalar(4)).mul(tf.scalar(5.67*Math.pow(10,-8))).mul(emissivity); // Outgoing longwave radiation
       console.log("--Outgoing Longwave Radiation:");
       console.log(outgoingLongwave.dataSync()[2165+919*imgW]);

     const netRadiationRn = incomingShortwave.sub(albedo.mul(incomingShortwave)).sub(outgoingLongwave).add(emissivity.mul(incomingLongwave)); // Rn or net radiation
       console.log("--Net Radiation (Rn):");
       console.log(netRadiationRn.dataSync()[2165+919*imgW]);

     const soilMoistureFluxG = thermalTensor.sub(273.15).mul(albedo.mul(.0074).add(.0038)).mul(ndvi.pow(4).mul(-.98).add(1)).mul(netRadiationRn); // Soil Moisture Flux
       console.log("--Soil Moisture Flux (G):");
       console.log(soilMoistureFluxG.dataSync()[2165+919*imgW]);
        tf.dispose([emissivity,albedo,outgoingLongwave]);
    // ------------------------------------
    // --- Outputs ---
    //let RawRn = mapTensor(netRadiationRn,500,700,0,255).toInt().dataSync();
    let RawSoilFlux = mapTensor(soilMoistureFluxG,50,175,0,255).toInt().dataSync();
    let RawThermal = mapTensor(thermalTensor,thermalMapping[0],thermalMapping[1],0,255).toInt().dataSync();

    tf.dispose([netRadiationRn,soilMoistureFluxG,thermalTensor]);

    //rnImage = makeImage(imgW,imgH,RawRn);
    soilFluxImage = makeImage(imgW,imgH,RawSoilFlux);
    thermalImage = makeImage(imgW,imgH,RawThermal);

    //RawRn = null;
    RawSoilFlux = null;
    RawThermal = null;

    addImages([rgb,soilFluxImage,thermalImage]);

    //rnImage.save(netRadiationImageFilename);
    //soilFluxImage.save(soilFluxImageFilename);
    //thermalImage.save(thermalImageFilename);
    // ---------------
  // - If the Rn, G, and Thermal images are provided, then continue (requires a restart for RAM considerations) -
}else if(checkRequirements([0,4]) && !checkRequirements([4,5])){

  // --- Inputs ---
    let RawThermal = [];
    thermalImageImp.loadPixels();
    thermalImageImp.pixels.forEach((c,i) => {
      if(i%4 == 0) RawThermal[i/4] = c;
    });
    thermalTensor = mapTensor(tf.tensor(RawThermal,[imgW,imgH]),0,255,thermalMapping[0],thermalMapping[1]);
    RawThermal = null;
  // --------------

  // --- Processing ---
    psiHg = tf.variable(tf.ones([imgW,imgH]));
    psiHs = tf.variable(tf.ones([imgW,imgH]));
    psiM = tf.variable(tf.ones([imgW,imgH]));

    frictionVelocityU = tf.variable(tf.fill([imgW,imgH],(.41*windSpeed)/(Math.log(heightWindSensor/(.12*plantHeightAvg)))));
    console.log("--Initial Friction Velocity U*:");
    console.log(frictionVelocityU.dataSync()[2165+919*imgW]);

    frictionVelocityU200 = frictionVelocityU.mul(Math.log(heightAir/(.12*plantHeightAvg))/.41);
    console.log("--Initial Friction Velocity U200:");
    console.log(frictionVelocityU200.dataSync()[2165+919*imgW]);

    frictionVelocityU.assign(frictionVelocityU200.mul(.41).div(Math.log(heightAir/(.12*plantHeightAvg))));
    console.log("--Second Friction Velocity U*:");
    console.log(frictionVelocityU.dataSync()[2165+919*imgW]);

    groundRoughnessRah = tf.variable(frictionVelocityU.mul(.41).reciprocal().mul(Math.log(heightWindSensor/heightGround))); // Ground Roughness
    console.log("--Initial Ground Roughness Rah:");
    console.log(groundRoughnessRah.dataSync()[2165+919*imgW]);

    console.log("Starting loop...");

    for(let c=0;c<2;c++){
      console.log(`Pass number: ${c}`);

       sensibleHeatFluxH = thermalTensor.sub(tedData.temperature).mul(airDensity).mul(1004).div(groundRoughnessRah); // Sensible Heat Flux
       console.log("--Current sensible Heat Flux Sample Grass Value:");
       console.log(sensibleHeatFluxH.dataSync()[2165+919*imgW]);

       moninObukhovLengthL = thermalTensor.mul(frictionVelocityU.pow(3)).mul(-1004).div(sensibleHeatFluxH.mul(.41*9.81));
       console.log("--Current Monin Obukhov Length:");
       console.log(moninObukhovLengthL.dataSync()[2165+919*imgW]);

       if(moninObukhovLengthL.min() > 0){
         psiM.assign(moninObukhovLengthL.reciprocal().mul(-10)); // Stability Corrections - M: Momentum, H: heat (height s, sensor; g, ground).
         psiHs.assign(moninObukhovLengthL.reciprocal().mul(-10));
         psiHg.assign(moninObukhovLengthL.reciprocal().mul(-.5));
       }else if(moninObukhovLengthL.max() < 0){
         psiM.assign(moninObukhovLengthL.reciprocal().mul(-3200).add(1).pow(.25).add(1).div(2).log().mul(2).add(moninObukhovLengthL.reciprocal().mul(-3200).add(1).pow(.5).add(1).div(2).log()).add(moninObukhovLengthL.reciprocal().mul(-3200).add(1).pow(.25).atan().mul(-2)).add(.5 * Math.PI));
         psiHs.assign(moninObukhovLengthL.reciprocal().mul(-32).add(1).pow(.5).add(1).div(2).log().mul(2));
         psiHg.assign(moninObukhovLengthL.reciprocal().mul(-1.6).add(1).pow(.5).add(1).div(2).log().mul(2));
       }else if(moninObukhovLengthL.sum() == 0){
         psiM.assign(tf.zeros([imgW,imgH]));
         psiHs.assign(tf.zeros([imgW,imgH]));
         psiHg.assign(tf.zeros([imgW,imgH]));
       }else{
        let tempLValues = moninObukhovLengthL.dataSync();
        let tempPsiM = [];
        let tempPsiHs = [];
        let tempPsiHg = [];
        tempLValues.forEach(v => {
          if(v>0){
            tempPsiM.push(-10/v);
            tempPsiHs.push(-10/v);
            tempPsiHg.push(-.5/v);
          }else if(v<0){
            tempPsiM.push(2 * Math.log((1+Math.pow(1-3200/v,.25))/2) + Math.log((1+Math.pow(1-3200/v,.5))/2) - 2*Math.atan(Math.pow(1-3200/v,.25)) + .5 * Math.PI);
            tempPsiHs.push(2*Math.log((1+Math.pow(1-32/v,.5))/2));
            tempPsiHg.push(2*Math.log((1+Math.pow(1-1.6/v,.5))/2));
          }else{
            tempPsiM.push(0);
            tempPsiHg.push(0);
            tempPsiHs.push(0);
          }
        });
        tempLValues = null;
        psiHg.assign(tf.tensor(tempPsiHg,[imgW,imgH]));
        psiHs.assign(tf.tensor(tempPsiHs,[imgW,imgH]));
        psiM.assign(tf.tensor(tempPsiM,[imgW,imgH]));
        tempPsiM = null;
        tempPsiHg = null;
        tempPsiHs = null;
       }
       frictionVelocityU.assign(frictionVelocityU200.mul(.41).div(psiM.mul(-1).add(Math.log(heightAir/heightGround))));
       console.log("--Updated Friction Velocity U*:");
       console.log(frictionVelocityU.dataSync()[2165+919*imgW]);

       groundRoughnessRah.assign(psiHs.mul(-1).add(psiHg).add(Math.log(heightWindSensor/heightGround)).div(frictionVelocityU.mul(.41)));
       console.log("--Ground Roughness Rah:");
       console.log(groundRoughnessRah.dataSync()[2165+919*imgW]);
    }
  // ------------------
  // --- Analyze Results ---
  console.log("--Sensible Heat Flux Sample Grass Value:");
  console.log(sensibleHeatFluxH.dataSync()[2165+919*imgW]);
  // ------------------
  // --- Outputs ---
    let RawSensibleHeatFlux = mapTensor(sensibleHeatFluxH,0,500,0,255).toInt().dataSync();
    tf.dispose([thermalTensor,sensibleHeatFluxH,moninObukhovLengthL,psiHs,psiM,psiHg]);

    sensHeatFlux = makeImage(imgW,imgH,RawSensibleHeatFlux);
    addImages([sensHeatFlux]);

    //sensHeatFlux.save(sensHeatFluxFilename);
  // ---------------

}else if(checkRequirements([0,5])){
  // --- Inputs ---
    let RawRn = [];
    netRadiationImageRn.loadPixels();
    netRadiationImageRn.pixels.forEach((c,i) => {
      if(i%4 == 0) RawRn[i/4] = c;
    });
    netRadiationRn = mapTensor(tf.tensor(RawRn,[imgW,imgH]),0,255,500,700);
    RawRn = null;

    let RawSoilFlux = [];
    soilFluxImageG.loadPixels();
    soilFluxImageG.pixels.forEach((c,i) => {
      if(i%4 == 0) RawSoilFlux[i/4] = c;
    });
    soilMoistureFluxG = mapTensor(tf.tensor(RawSoilFlux,[imgW,imgH]),0,255,50,175);
    RawSoilFlux = null;

    let RawSensibleHeatFlux = [];
    sensibleHeatFluxImage.loadPixels();
    sensibleHeatFluxImage.pixels.forEach((c,i) => {
      if(i%4 == 0) RawSensibleHeatFlux[i/4] = c;
    });
    sensibleHeatFluxH = mapTensor(tf.tensor(RawSensibleHeatFlux,[imgW,imgH]),0,255,0,500);
    RawSensibleHeatFlux = null;
  // --------------
  // --- Processing ---
  const latentHeatFluxLambda = netRadiationRn.sub(soilMoistureFluxG).sub(sensibleHeatFluxH); // Latent Heat Flux
  console.log("--Latent Heat Flux Lambda:");
  console.log(latentHeatFluxLambda.dataSync()[2165+919*imgW]);

  const hendricksRatioChevron1 = latentHeatFluxLambda.div(latentHeatFluxLambda.add(sensibleHeatFluxH)); // Whatever chevron is
  console.log("--Hendrick's Ratio (Chevron):");
  console.log(hendricksRatioChevron1.dataSync()[2165+919*imgW]);

  tf.dispose([sensibleHeatFluxH,latentHeatFluxLambda,netRadiationRn,soilMoistureFluxG]);

  const soilSaturation = tf.exp(hendricksRatioChevron1.sub(1).div(.42)); // Soil Saturation
  console.log("--Soil Saturation (S):");
  console.log(soilSaturation.dataSync()[2165+919*imgW]);

  tf.dispose(hendricksRatioChevron1);

  // ------------------
  // --- Outputs ---
    let RawSoilSat = mapTensor(soilSaturation,0,1,0,255).toInt().dataSync();
    tf.dispose([soilSaturation]);

    soilSaturationImage = makeImage(imgW,imgH,RawSoilSat);
    RawSoilSat = null;

    addImages([soilSaturationImage]);

    //soilSaturationImage.save(soilSaturationFilename);
  // ---------------
  };
  });
  frameRate(1);
}

// --- p5 'While true' ---
function draw() {
  clear();
  drawNextImage(frameCount);
}
