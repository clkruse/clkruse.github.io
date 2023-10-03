import streamlit as st
import pandas as pd
import plotly.express as px

att = pd.read_csv('/Users/ckruse/Downloads/MLB Attendance.csv', index_col='Unnamed: 1')
att = att.drop('Unnamed: 0', axis=1)
att = att.T
att = att.drop('2021')

wins = pd.read_csv('/Users/ckruse/Downloads/MLB Wins.csv', index_col='Unnamed: 0')
wins = wins.T
wins = wins.drop('2021')

# create a scatter plot of wins vs. attendance
fig = px.scatter()
for col in wins.columns:
    fig.add_scatter(x=wins[col], y=att[col], mode='markers', name=col)
# set all marker colors to dark green
for i in range(len(fig.data)):
    fig.data[i].marker.color = 'darkgreen'
# set hover info to team name and year
fig.update_traces(hovertemplate='%{text}')
for i in range(len(fig.data)):
    fig.data[i].text = wins.index
# set x and y axis titles
fig.update_xaxes(title_text='Wins')
fig.update_yaxes(title_text='Attendance')
# set figure title
fig.update_layout(title_text='Wins vs. Attendance')

fig.show()