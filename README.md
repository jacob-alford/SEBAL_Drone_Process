# SEBAL_Drone_PROCESS
Processes drone images using the SEBAL algorithm to calculate soil saturation.

## Inputs
Takes two input images (and can be configred differently):
1. RGB Image (where the red, green, and blue channels correspond to the red, green, and blue bands respectively captured by the drone).
1. Composite Image (where the red, green, and blue channels correspond to the red, thermal, and near-infared bands respectively captured by the drone).

### Sample Inputs
#### RGB Image:
![RGB Image](RGBoutput2.jpg)
#### Composite Image:
![Composite Image](composite2.jpg)

### Sample Outputs
Name | Image
---- | -----
Net Radiation (Rn) | ![Net Rad](RnImage.jpg)
Thermal Image (extracted) | ![Thermal](thermalImg.jpg)
Soil Flux (G) | ![Soil Flux](SoilFlux.jpg)
Sensible Heat Flux (H) | ![Heat Flux](sensHeatFlux.jpg)
Soil Saturation (S) | ![Soil Sat](soilSat.jpg)
