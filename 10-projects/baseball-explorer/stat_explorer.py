import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px


# load data
#@st.cache
def load_data():
    data_path = 'https://raw.githubusercontent.com/clkruse/clkruse.github.io/master/10-projects/baseball-explorer/fangraphs-batter-stats-simple.csv'
    df = pd.read_csv(data_path)
    # convert columns with percentages from strings to floats
    for c in df.columns:
        try:
            df[c] = df[c].str.replace('%', '').astype(float) / 100
        except:
            pass
    return df

df = load_data()

def stat_scatter():
    data = df[df['AB'] > st.session_state.min_at_bats]
    # compute correlation coefficient between the two stats
    corr = np.corrcoef(data[st.session_state.stat_a], data[st.session_state.stat_b])[0, 1]
    fig = px.scatter(
        x=data[st.session_state.stat_a],
        y=data[st.session_state.stat_b], 
        range_color=[df['WAR'].min() - 1, df['WAR'].max() + 1],
        color=data['WAR'], hover_name=data['Name'], 
        title=f"{st.session_state.stat_a} vs. {st.session_state.stat_b}: r<sup>2</sup> = {corr**2:.2f}",
        color_continuous_scale='plasma')
    # set hover text to show war and stats
    fig.update_traces(hovertemplate='<br>'.join([
        '%{hovertext}',
        # add stat names and values
        f'{st.session_state.stat_a}: %{{x}}',
        f'{st.session_state.stat_b}: %{{y}}',
        'WAR: %{marker.color:.2f}',
    ]))
    fig.update_layout(height=800, width=800)
    fig.update_xaxes(title=st.session_state.stat_a)
    fig.update_yaxes(title=st.session_state.stat_b)
    fig.update_layout(coloraxis_colorbar=dict(title='WAR'))
        # stroke each point with a white outline
    fig.update_traces(marker_line_color='gray', marker_line_width=0.5)
    # make margins slimmer
    #fig.update_layout(margin=dict(l=20, r=20, t=60, b=20))
    # set the background color
    fig.update_layout(plot_bgcolor='#ebebeb', paper_bgcolor='#fafafa')
    # set the grid color
    fig.update_layout(xaxis_gridcolor='#dddddd', yaxis_gridcolor='#dddddd')
    # set font
    fig.update_layout(font_family='Arial')
    # increase title size
    fig.update_layout(title_font_size=20)
    # make the points bigger
    fig.update_traces(marker_size=7)
    return fig

# initialize stat_a and stat_b
st.session_state.stat_a = 'BB'
st.session_state.stat_b = 'HR'

# initialize a scatter plot
fig_location = st.empty()

# create sidebar
st.sidebar.title('Stat Explorer')
st.sidebar.markdown('Select two stats to explore')
st.sidebar.markdown('---')
st.session_state.stat_a = st.sidebar.selectbox('Select stat A', df.columns[2:], index=df.columns.get_loc('AVG')-2, on_change=stat_scatter)
st.session_state.stat_b = st.sidebar.selectbox('Select stat B', df.columns[2:], index=df.columns.get_loc('SLG')-2, on_change=stat_scatter)
st.sidebar.markdown('---')
st.sidebar.markdown('**Minimum At Bats**')
st.session_state.min_at_bats = st.sidebar.slider('Select minimum at bats', int(df['AB'].min()), int(df['AB'].max()-1), 150, on_change=stat_scatter)

# update scatter plot when variables change
with fig_location:
    fig = stat_scatter()
    st.plotly_chart(fig, use_container_width=True)