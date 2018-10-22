//---SEBAL-Specific-Constants
const sigma = 5.67 * Math.pow(10,-8); // Boltzman Constant
const surfEmiss = .8; // Surface Emmissivity (epsilon_s)
const airTemp = 71.6; // Air temperature at the time of capture
//---Astronomy-Specific-Constants
const perihelion = 2; //The day in January of the perihelion, used for distance calculation
const ast_a = 1.496 * Math.pow(10,8); //Earth's semi-major axis
const ast_e = .0167; //Earth's eccentricity

// --- Predeclaration ---
let tedData;
let dateTaken;
let thermal;
let nearInfared;
let ndviImage;
let imgW;
let imgH;
let thermalTensor;
let nearInfaredTensor;

// --- Class Definition and Supporting Functions
class GeoData{
  constructor(date){
    let doy = date.getDOY();
    this.solarDeclination = -1 * Math.asin(.39779 * Math.cos(.98565 * (doy + 10) + 1.914 * Math.sin(.98565 * (doy - 2))));
    this.solarDistance = (ast_a * (1-Math.pow(ast_e,2)))/(1+(ast_e * Math.cos((360/365.25) * (doy-perihelion))));
  }
  solarDecToTensor(){
    return tf.scalar(this.solarDeclination);
  }
  solarDistToTensor(){
    return tf.scalar(this.solarDistance);
  }
}

function makeImage(w,h,pixArr){
  let tempImage = createImage(w,h);
  for(let y=0;y<imgH;y++){
    for(let x=0;x<imgW;x++){
      tempImage.set(x,y,pixArr[x+y*w]);
    }
  }
  tempImage.updatePixels();
  return tempImage;
}

Date.prototype.isLeapYear = function() {
    var year = this.getFullYear();
    if((year & 3) != 0) return false;
    return ((year % 100) != 0 || (year % 400) == 0);
};
Date.prototype.getDOY = function() {
    var dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var mn = this.getMonth();
    var dn = this.getDate();
    var dayOfYear = dayCount[mn] + dn;
    if(mn > 1 && this.isLeapYear()) dayOfYear++;
    return dayOfYear;
};

// --- Pre-Initialization Asset Fetching---
function preload(){
  thermal = loadImage('Thermal.jpg');
  nearInfared = loadImage('Near_Infared.jpg');
}

// --- p5 Initialization ---
function setup() {
  // --- Misc Geologic Data ---
  tedData = new GeoData(new Date('October 10, 2018'));

  imgW = thermal.width;
  imgH = thermal.height;
  createCanvas(1000,636);

  // --- Instanciate the ECMAScript ImageData Class for Tensorflow ---
  let nirReds = new ImageData(thermal.width,thermal.height);
  let nirNIR = new ImageData(thermal.width,thermal.height);

  nearInfared.loadPixels();

  // --- Assign the respective channel values to the ImageData objects above ---
  for(let c=0;c<nearInfared.pixels.length;c+=4){
    nirReds.data[c] = nearInfared.pixels[c];
    nirNIR.data[c] = nearInfared.pixels[c+2];
    nirReds.data[c+1] = 0;
    nirReds.data[c+2] = 0
    nirReds.data[c+3] = 0;
    nirNIR.data[c+1] = 0;
    nirNIR.data[c+2] = 0
    nirNIR.data[c+3] = 0;
  }
  // --- TensorFlow Garbage Collect ---
  tf.tidy(() => {
    // --- Create the tensors ---
    redsTensor = tf.squeeze(tf.fromPixels(nirReds,1).toFloat());
    nirTensor = tf.squeeze(tf.fromPixels(nirNIR,1).toFloat());

    // --- Calculate NDVI ---
    let ndvi = nirTensor.sub(redsTensor).div(nirTensor.add(redsTensor)).mul(255).toInt();
    /*----------------------- [(NIR - Reds)/(NIR + Reds)] * 255 -----------------------*/
    let rawNDVI = ndvi.dataSync();

    // --- Create the p5 image ---
    ndviImage = makeImage(imgW,imgH,rawNDVI);
  });

  // --- Manual Garbage Collect ---
  nirReds = null;
  nirNIR = null;

}

// --- p5 'While true' ---
function draw() {
  frameRate(1);
  clear();
  if(frameCount%2 == 0) image(ndviImage,0,0,500,636);
  else image(nearInfared,0,0,500,636);
}
