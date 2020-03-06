import math
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

db = pd.read_json('bleaching_stats.json')

variables = {
    "sst": {
        "min": 5/0.01,
        "max": 50/0.01
    },
    "chlor_a": {
        "min": 0,
        "max": 5
    },
    "velocity": {
        "min": 0,
        "max": 25/0.001
    },
    "salinity": {
        "min": 0,
        "max": 20/0.001
    },
}



for variable in db.columns:
    if 'raw_' in variable:
        product = str.split(variable, 'raw_')[1]
        means, meds, mins, maxs, vars = [], [], [], [], []

        for entry in db[variable]:
            if entry == entry:
                means.append(np.mean(entry))
                meds.append(np.median(entry))
                mins.append(np.min(entry))
                maxs.append(np.max(entry))
                vars.append(np.var(entry))
            else:
                means.append(np.NaN)
                meds.append(np.NaN)
                mins.append(np.NaN)
                maxs.append(np.NaN)
                vars.append(np.NaN)

        db['mean_' + product] = means
        db['med_' + product] = meds
        db['min_' + product] = mins
        db['max_' + product] = maxs
        db['variance_' + product] = vars



stats = ['mean_', 'med_', 'min_', 'max_', 'variance_']
for stat in stats:
    # Merge the multiple sources of chlorophyll a
    # Prefer seawifs, then modis terra, then modis aqua
    db[stat + 'chlor_a'] = db[stat + 'chlor_a_seawifs'].fillna(db[stat + 'chlor_a_terra']).fillna(db[stat + 'chlor_a_aqua'])

    db[stat + 'chlor_a'].loc[db[stat + 'chlor_a'] > variables['chlor_a']['max']] = np.NaN

    db[stat + 'chlor_a'].loc[db[stat + 'chlor_a'] < variables['chlor_a']['min']] = np.NaN

    #db[stat + 'chlor_a'] = db[stat + 'chlor_a'].clip(variables['chlor_a']['min'], variables['chlor_a']['max'])

    # Merge the multiple sources of temperature
    # Prefer sst WHOI model, then OISST
    db[stat + 'sst'] = db[stat + 'sst_whoi'].fillna(db[stat + 'sst'])
    #db[stat + 'sst'] = db[stat + 'sst'].clip(variables['sst']['min'], variables['sst']['max'])

    db[stat + 'sst'].loc[db[stat + 'sst'] > variables['sst']['max']] = np.NaN
    db[stat + 'sst'].loc[db[stat + 'sst'] < variables['sst']['min']] = np.NaN

    # combine the current velocity vector into magnitude
    vel_mag = lambda u, v: math.sqrt(u ** 2  + v ** 2)
    db[stat + 'velocity'] = db[stat + 'velocity_u'].combine(db[stat + 'velocity_v'], vel_mag)
    #db[stat + 'velocity'] = db[stat + 'velocity'].clip(variables['velocity']['min'], variables['velocity']['max'])
    db[stat + 'velocity'].loc[db[stat + 'velocity'] > variables['velocity']['max']] = np.NaN
    db[stat + 'velocity'].loc[db[stat + 'velocity'] < variables['velocity']['min']] = np.NaN

    #db[stat + 'salinity'] = db[stat + 'salinity'].clip(variables['salinity']['min'], variables['salinity']['max'])
    db[stat + 'salinity'].loc[db[stat + 'salinity'] > variables['salinity']['max']] = np.NaN
    db[stat + 'salinity'].loc[db[stat + 'salinity'] < variables['salinity']['min']] = np.NaN


healthy = db[db['severity'] == 0]
bleaching = db[db['severity'] != 0]

counter = 1
plt.figure(figsize=(24, 22))
for variable in variables:
    for stat in stats:
        mean_healthy = healthy[stat + variable].mean()
        var_healthy = math.sqrt(healthy[stat + variable].var())
        mean_bleaching = bleaching[stat + variable].mean()
        var_bleaching = math.sqrt(bleaching[stat + variable].var())
        plt.subplot(4,5,counter)
        plt.errorbar([0, 1], [mean_healthy, mean_bleaching], [var_healthy, var_bleaching], fmt='.', color='black')
        plt.bar(0, mean_healthy)
        plt.bar(1, mean_bleaching, color='r')
        plt.xticks([0, 1], ['Healthy', 'Bleaching'])
        #plt.legend(['Healthy', 'Bleaching'])
        title = str(stat + variable + "\nHealthy: {0:.1f}, Bleached: {1:.1f}").format(mean_healthy, mean_bleaching)
        plt.title(title)
        counter += 1
plt.savefig('Mean Value Comparison.png', dpi=600)
plt.show()


counter = 1
plt.figure(figsize=(24, 22))
for variable in variables:
    for stat in stats:
        val_healthy = healthy[stat + variable].dropna()
        val_bleaching = bleaching[stat + variable].dropna()
        plt.subplot(4,5,counter)
        bins = np.histogram(np.hstack((val_healthy, val_bleaching)), bins=100)[1]
        plt.hist(val_healthy, bins, histtype='step', density=True)
        plt.hist(val_bleaching, bins, color='r', histtype='step', density=True)
        plt.legend(['Healthy', 'Bleaching'])
        title = str(stat + variable + "\nHealthy: {0:.1f}, Bleached: {1:.1f}").format(np.mean(val_healthy), np.mean(val_bleaching))
        plt.title(title)
        counter += 1
plt.savefig('Distribution of Mean Values.png', dpi=600)
plt.show()
title
