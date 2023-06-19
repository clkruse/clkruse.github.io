import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from datetime import datetime
import streamlit as st
import joypy

st.title('Western States 100 Split Calculator')
split_names = ['Lyon Ridge', 'Red Star Ridge', 'Duncan Canyon', 'Robinson Flat', "Miller's Defeat", 'Dusty Corners', 'Last Chance', "Devil's Thumb", 'El Dorado Creek', 'Michigan Bluff', 'Foresthill', 'Dardanelles (Cal-1)', 'Peachstone (Cal-2)', 'Rucky Chucky', 'Green Gate', 'Auburn Lake Trails', 'Quarry Road', 'Pointed Rocks', 'Robie Point', 'Finish']
split_mileage = [10.3, 15.8, 24.4, 30.3, 34.4, 38.0, 43.3, 47.8, 52.9, 55.7, 62.0, 65.7, 70.7, 78.0, 79.8, 85.2, 90.7, 94.3, 98.9, 100.2]
splits = pd.read_csv('https://raw.githubusercontent.com/clkruse/clkruse.github.io/master/wser/wser_splits/wser_finishers.csv')

def get_cohort(df, start, end):
    return df[(df['Time'] >= start) & (df['Time'] < end)]

def compute_splits(df, start, end, write=False):
    cohort = get_cohort(df, start, end)
    median_times = pd.DataFrame()
    median_times['Split'] = split_names
    median_times['Mile'] = [f"{s:.1f}" for s in split_mileage]
    median_times['Median'] = [cohort[split].median() for split in split_names]
    median_times['Time of Day'] = [datetime(2020, 1, 1, 5, 0) + pd.to_timedelta(time, unit="h") for time in median_times['Median']]
    median_times['Time of Day'] = median_times['Time of Day'].dt.strftime('%I:%M %p')
    # convert decimal hours into hours:minutes
    median_times['Median'] = median_times['Median'].apply(lambda x: f'{int(x)}:{int((x-int(x))*60):02d}')
    if write:
        median_times.to_csv(f'{start}-{end} Hour Finishers Split Times.csv', index=False)
    return median_times

st.markdown('Select a start and end time to see the distribution of split times for runners who finished between those times.')
# create a start and end time slider in a two column layout
col1, col2 = st.columns(2)
with col1:
    cohort_start = st.slider('Goal Finish Time Begin', 0.0, 30.0, 23.0, 0.5)
with col2:
    cohort_end = st.slider('Goal Finish Time End', 0.0, 30.0, 24.0, 0.5)

# convert decimal hours into hours:minutes
cohort_start_time = f'{int(cohort_start)}:{int((cohort_start-int(cohort_start))*60):02d}'
cohort_end_time = f'{int(cohort_end)}:{int((cohort_end-int(cohort_end))*60):02d}'

# create a dataframe of the median times for each split
cohort_splits = compute_splits(splits, cohort_start, cohort_end)
# set the index to the split name
cohort_splits.set_index('Split', inplace=True)
st.subheader(f'Split Times for Runners Finishing Between {cohort_start_time} and {cohort_end_time}')
st.dataframe(cohort_splits.T)

# create a joyplot of times at each split
cohort = get_cohort(splits, cohort_start, cohort_end)
title = f'Distribution of Split Times for {len(cohort)} WSER {cohort_start_time}-{cohort_end_time} Finishers - 2017-2022'
fig, ax = plt.subplots(figsize=(10, 6), facecolor='white', dpi=250)
joyplot, ax = joypy.joyplot(
    cohort[split_names], 
    ax = ax,
    overlap=2, 
    title=title, 
    x_range=[-1, cohort_end + 1], 
    colormap=plt.cm.PuBuGn_r, 
    grid='x'
    )
ax[-1].set_xlabel('Time (hours)')
st.subheader(f'Distributions of Split Times for {cohort_start_time}-{cohort_end_time} Finishers')
st.pyplot(joyplot)

# create a seaborn kdeplot of times at each split
cohort = get_cohort(splits, cohort_start, cohort_end)
sns.set_style('darkgrid')
# create a figure with 5,4 subplots
fig, ax = plt.subplots(5, 4, figsize=(12, 12), dpi=250, facecolor='white')
# plot each split on a subplot
for i, split in enumerate(split_names):
    sub_ax = ax[i//4, i%4]
    sns.kdeplot(cohort[split], fill=True, ax=sub_ax)
    sub_ax.set_title(f'{split} - {split_mileage[i]} miles')
    sub_ax.set_xlabel('Time (hours)')
    sub_ax.set_ylabel('Density')
    # create a vertical line at the median
    color = 'navy'
    sub_ax.axvline(cohort[split].median(), color=color, linestyle='--', label='Median')

    # get the time of day. The time of day is given by 5:00am + the median time
    time_of_day = datetime(2020, 1, 1, 5, 0) + pd.to_timedelta(cohort[split].median(), unit="h")
    time_of_day = time_of_day.strftime('%I:%M %p')
    # label the median time
    median_time = cohort[split].median()
    hours = int(median_time)
    minutes = int((median_time - hours)*60)
    # label the median time and time of day
    sub_ax.text(cohort[split].median()+0.1, 0.1, f'{hours}:{minutes:02d}\n{time_of_day}', color=color)

plt.suptitle(f'Distribution of Split Times for {len(cohort)} WSER {cohort_start_time}-{cohort_end_time} Finishers - 2017-2022', y=1.0, fontsize=20)
plt.tight_layout()
st.subheader(f'Detailed Spit Time Distributions for {cohort_start_time}-{cohort_end_time} Finishers')
st.pyplot(fig)