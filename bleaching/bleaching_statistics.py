from operator import itemgetter
import math
import csv
from tqdm import trange
from datetime import date
import time
import numpy as np
import matplotlib.pyplot as plt
from IPython.display import Image
import ee
import json
import pandas as pd
plt.rcParams['figure.figsize'] = [10, 9]


def key_to_vec(db, key):
    return(np.array(list(map(itemgetter(key), db))))


def read_db(db_name):
    events = []
    database = csv.DictReader(open(db_name))
    for row in database:
        # Check if any elements are missing. If so, ignore that record
        if all(value != '' for value in row.values()):
            event = {
                "lat": float(row['Lat']),
                "lng": float(row['Lng']),
                "year": int(row['Year']),
                "month": int(row['Month']),
                "severity": int(row['Severity'])
            }
            events.append(event)
    return(events)


class Event:

    def __init__(self, database_entry, dataset, product, name):
        self.database_entry = database_entry
        self.dataset = dataset
        self.product = product
        self.name = name

    def get_time(self, window):
        year = self.database_entry['year']
        month = self.database_entry['month']
        event_date = date(year, month, 1)
        unix_time = time.mktime(event_date.timetuple())
        start_time = unix_time - 3600 * 24 * window
        start_date = str(date.fromtimestamp(start_time))
        end_time = unix_time + 3600 * 24 * window
        end_date = str(date.fromtimestamp(end_time))
        self.start_date = start_date
        self.end_date = end_date

    def get_location(self, buffer_size):
        #self.buffer_size = buffer_size
        location = ee.Geometry.Point(
            self.database_entry['lng'], self.database_entry['lat']).buffer(buffer_size)
        self.location = location

    def get_dataset(self):
        self.data = ee.ImageCollection(self.dataset) \
            .filterDate(self.start_date, self.end_date) \
            .select(self.product) \
            .filterBounds(self.location) \

    # This function is copied/modified from the ts_extract function by @loicdtx

    def extract_time_series(self, stat):
        if stat == 'mean':
            fun = ee.Reducer.mean()
        elif stat == 'median':
            fun = ee.Reducer.median()
        elif stat == 'max':
            fun = ee.Reducer.max()
        elif stat == 'min':
            fun = ee.Reducer.min()

        def _reduce_region(image):
            """Spatial aggregation function for a single image and a polygon feature"""
            scale = 30

            stat_dict = image.reduceRegion(fun, self.location, scale)

            # FEature needs to be rebuilt because the backend doesn't accept to map functions that return dictionaries
            return ee.Feature(None, stat_dict)
        feature_collection = self.data.map(_reduce_region).getInfo()

        def simplify(feature_collection):
            def feature2dict(f):
                id = f['id']
                out = f['properties']
                out.update(id=id)
                return out
            out = [feature2dict(x) for x in feature_collection['features']]
            return out
        time_series = simplify(feature_collection)
        return(time_series)

    def process_event(self, window, buffer_size, stat):
        self.get_time(window)
        self.get_location(window)
        self.get_dataset()
        ts = self.extract_time_series(stat)

        output_data = {}
        raw = []
        for element in ts:
            if self.product in element:
                raw.append(element[self.product])
        if len(raw) > 0:
            mean = float(np.mean(raw))
            max = float(np.max(raw))
            min = float(np.min(raw))
            var = float(np.var(raw))

            output_data['raw_' + self.name] = raw
            output_data['mean_' + self.name] = mean
            output_data['max_' + self.name] = max
            output_data['min_' + self.name] = min
            output_data['var_' + self.name] = var
        self.database_entry.update(output_data)
        return(self.database_entry)

def get_data(db_entry, dataset, band, name, window, buffer):
    Event(db_entry, dataset,band, name).process_event(window, 10000, 'mean')


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
window = 20

for round in trange(15):
    for i in trange(100):
        index = np.random.randint(len(database))
        for product in products:
            Event(database[index], products[product]['url'], products[product]['band'], product).process_event(window, 10000, 'mean')


    with open('bleaching_stats.json', 'w') as fn:
        json.dump(database, fn, indent=4)

    df = pd.DataFrame(database)
    df.to_csv('bleaching_stats.csv')
