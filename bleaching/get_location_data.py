from read_db import read_db
import ee
import numpy as np

ee.Initialize()

database = read_db('bleaching.csv')

products = {
    "sst": {
        "url": "NOAA/CDR/OISST/V2",
        "band": "sst"
        },
    #"sst_whoi": {
    #    "url": "NOAA/CDR/SST_WHOI/V2",
    #    "band": "sea_surface_temperature"
    #    },
    "chlor_a_terra": {
        "url": "NASA/OCEANDATA/MODIS-Terra/L3SMI",
        "band": "chlor_a"
        },
    "chlor_a_aqua": {
        "url": "NASA/OCEANDATA/MODIS-Aqua/L3SMI",
        "band": "chlor_a"
        },
    "chlor_a_seawifs": {
        "url": "NASA/OCEANDATA/SeaWiFS/L3SMI",
        "band": "chlor_a"
        },
    "salinity": {
        "url": "HYCOM/sea_temp_salinity",
        "band": "salinity_0"
        },
    "velocity_u": {
        "url": "HYCOM/sea_water_velocity",
        "band": "velocity_u_0"
        },
    "velocity_v": {
        "url": "HYCOM/sea_water_velocity",
        "band": "velocity_v_0"
        }
}


# what am I trying to do?
## I want to build up norms for each of the parameters in the product set, and each location and time in the dataset
## for each event in the bleaching database, I want to grab data that is from the same location all


img_col = ee.ImageCollection(products['sst']['url']).select(products['sst']['band'])

range = img_col.reduceColumns(ee.Reducer.minMax(), ["system:time_start"]).getInfo()

range
start, end = range['min'], range['max']


def get_time_series(product, db_entry, window):
    img_col = ee.ImageCollection(products[product]['url']).select(products[product]['band']).filterDate(*get_time(db_entry, window))

    buffer_radius = 100000

    location = ee.Geometry.Point(db_entry['lng'], db_entry['lat']-.5).buffer(buffer_radius)

    info = img_col.getRegion(location, buffer_radius*2).getInfo()
    header = info[0]
    data = np.array(info[1:])
    time_index = header.index('time')
    times = [datetime.fromtimestamp(i/1000) for i in (data[0:,time_index].astype(int))]

    values_index = header.index(products[product]['band'])

    values = data[0:, values_index].astype(np.float)
    #print(data[0:10, values_index].astype(np.float))

    return(times, values)
