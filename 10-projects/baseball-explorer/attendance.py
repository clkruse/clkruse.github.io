import streamlit as st
import pandas as pd
import plotly.express as px

att = pd.read_csv('https://raw.githubusercontent.com/clkruse/clkruse.github.io/master/10-projects/baseball-explorer/MLB%20Attendance.csv', index_col='Unnamed: 1')
att = att.drop('Unnamed: 0', axis=1)
att = att.T
att = att.drop('2021')

wins = pd.read_csv('https://raw.githubusercontent.com/clkruse/clkruse.github.io/master/10-projects/baseball-explorer/MLB%20Wins.csv', index_col='Unnamed: 0')
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

st.plotly_chart(fig, use_container_width=True)

# create a dataframe of these correlation coefficients
corr = pd.DataFrame()
for col in att.columns:
    corr[col] = [att[col].corr(wins[col])]
corr = corr.T
corr.columns = ['Correlation']
# sort 
corr = corr.sort_values('Correlation', ascending=False)
# show the dataframe
st.write(corr.head(40))