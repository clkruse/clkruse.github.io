from tqdm import trange
from datetime import date, datetime
import time
import numpy as np
import matplotlib.pyplot as plt
import ee
import json
import pandas as pd
from read_db import read_db
plt.rcParams['figure.figsize'] = [10, 9]

def get_time(db_entry, window):
    year = db_entry['year']
    month = db_entry['month']
    event_date = date(year, month, 1)
    unix_time = time.mktime(event_date.timetuple())
    start_time = unix_time - 3600 * 24 * window
    start_date = str(date.fromtimestamp(start_time))
    end_time = unix_time + 3600 * 24 * window
    end_date = str(date.fromtimestamp(end_time))
    start_date = start_date
    end_date = end_date
    return(start_date, end_date)



def get_time_series(product, db_entry, window):
    img_col = ee.ImageCollection(products[product]['url']).select(products[product]['band']).filterDate(*get_time(db_entry, window))
    buffer_radius = 100000

    location = ee.Geometry.Point(db_entry['lng'], db_entry['lat']-.5).buffer(buffer_radius)

    try:
        info = img_col.getRegion(location, buffer_radius*2).getInfo()
    except:
        return([], [])
    header = info[0]
    data = np.array(info[1:])
    #if np.shape(data)[0] == 0:
    #    return([], [])

    try:
        time_index = header.index('time')
        times = [datetime.fromtimestamp(i/1000) for i in (data[0:,time_index].astype(int))]

        values_index = header.index(products[product]['band'])
        values = data[0:, values_index].astype(np.float).tolist()
    except:
        return([], [])
    #print(data[0:10, values_index].astype(np.float))

    return(times, values)

products = {
    "sst": {
        "url": "NOAA/CDR/OISST/V2",
        "band": "sst"
        },
    "sst_whoi": {
        "url": "NOAA/CDR/SST_WHOI/V2",
        "band": "sea_surface_temperature"
        },
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

ee.Initialize()
database = read_db('bleaching.csv')
window_size = 30

for i in trange(5):

    for product in products:
        t, v = get_time_series(product, database[i], window_size)
        database[i]['raw_' + product] = v

    with open('yew!.json', 'w') as fn:
        json.dump(database, fn, indent=4)
