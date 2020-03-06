import csv

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
