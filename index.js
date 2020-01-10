const mysql = require("mysql");
const XLSX = require('xlsx');
const { API, cond, and } = require('space-api');
const fs = require('fs');
const os = require('os');
const api = new API('logistics', 'http://localhost:4122');
const db = api.DB('mysql');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "1234",
  database: "logistics",
});

con.connect((err) => {
  if(err) throw err;
  console.log('connected!!');
})

const workbook = XLSX.readFile('Logistic_App_Masters_Bulk_Upload_2.xlsx');
const sheet_name_list = workbook.SheetNames;

let tables = new Array();
sheet_name_list.forEach(tableName =>{
  
  tables.push(tableName.replace(" ", "_"));
});
// let storesData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[4]]);
// let timingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[5]]);
// const time= Object.values(timingData[0])
// const store_cities = [...new Set(storesData.map(data => data.City))]

// const combine_city = store_cities.concat(time)
// const unique_city = combine_city.filter((data, index, arr) => {
//   return arr.indexOf(data) === index
// })

// const sorted_city = unique_city.sort((city_a, city_b) => {
//   return city_a.localeCompare(city_b);
// })

// fs.writeFileSync('unique_city.csv', sorted_city.join(os.EOL))

const srcToCity = new Array();
let storesData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[4]]);
    storesData.forEach(data => {
      storesData.forEach(newdata => {
        if(data['Store Code'] !== newdata['Store Code']){
        let obj = {
          src_store_code: data['Store Code'],
          src_city: data.City,
          dest_store_code: newdata['Store Code'],
          dest_city: newdata.City
        }
        srcToCity.push(obj);
        }
      })
    })
    let timeData = new Array()
    storesData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[5]]);
    const obj1 = Object.values(storesData[0]);
    for(var i=1; i< storesData.length; i++){
      let obj2 = Object.values(storesData[i]);
      for(var j=0; j < obj2.length-1; j++){
        let obj3 = {
          src: obj2[0],
          des: obj1[j],
          time: obj2[j+1]
        } 
        timeData.push(obj3);
      }
    }
    var finalData = new Array()
    
    for(var i=0;i< srcToCity.length; i++){
      for(var j=0; j< timeData.length; j++){
      if(srcToCity[i].src_city.toLowerCase() === timeData[j].src.toLowerCase() && srcToCity[i].dest_city.toLowerCase() === timeData[j].des.toLowerCase()){
         finalData.push(Object.assign({}, srcToCity[i], {time: timeData[j].time})); 
        } 
      }
    }

let insertData = ''

    
let createTable = ''


for(var i = 0 ; i< tables.length; i++){
  if(tables[i] === 'stores'){
    createTable = `CREATE TABLE IF NOT EXISTS ${tables[i]} (store_code VARCHAR(50) PRIMARY KEY,
                  store_name VARCHAR(50) NOT NULL,
                  partner  VARCHAR(50) NOT NULL,
                  city  VARCHAR(50) NOT NULL )`;
                  con.query(createTable, (err, result) => {
                    if(err) throw err;
                  });
    }else if(tables[i] === 'users'){
       createTable = `CREATE TABLE IF NOT EXISTS ${tables[i]} (id VARCHAR(50) PRIMARY KEY,
                  email VARCHAR(50) NOT NULL,
                  name  VARCHAR(50) NOT NULL,
                  pass  VARCHAR(75) NOT NULL,
                  role  VARCHAR(10) NOT NULL,
                  store_code VARCHAR(50))`;
                  con.query(createTable, (err, result) => {
                    if(err) throw err;
                  });
    }else if(tables[i] === 'timings'){
      createTable = `CREATE TABLE IF NOT EXISTS ${tables[i]} (src_store_code VARCHAR(50) NOT NULL,
                    dest_store_code VARCHAR(50) NOT NULL,
                    no_of_days INT)`;
                    con.query(createTable, (err, result) => {
                    if(err) throw err;
                    });
    }else{
      createTable = `CREATE TABLE IF NOT EXISTS ${tables[i]} (name VARCHAR(50) PRIMARY KEY)`;
              con.query(createTable, (err, result) => {
                if(err) throw err;
              });
    }
var cell = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[i]]);
for(var j = 0; j < cell.length; j++){
 if(tables[i] === 'stores'){
    const a = Object.values(cell[j])
    insertData = `INSERT INTO ${tables[i]} (store_code, store_name, partner, city) 
    SELECT * FROM (SELECT '${a[0]}', '${a[1]}', '${cell[j].Partner}', '${cell[j].City}') 
    AS tmp WHERE NOT EXISTS 
    (SELECT store_code FROM ${tables[i]} WHERE store_code = '${a[0]}') LIMIT 1`;
    con.query(insertData, (err) => {
    if(err) console.log(err);
    })
 }else if(tables[i] === 'users'){ 
   if(cell[j].Username){
    db.signUp(cell[j].Username, cell[j].Username, cell[j].Password, cell[j].Role).then(res => {
      if(res.status === 200){
        console.log('sucessfully inserted user ');
      }
    }).catch(ex => {
      console.log(ex);
    });
  
    
    
    const whereClause = cond("name", "==", cell[j]['Store code']);
    db.update("users").where(whereClause).set({store_code: cell[j]['Store code']}).apply().then(res => {
      if(res.status === 200){
        console.log('sucessfully updated user')
      }
    }).catch(ex => {
      console.log(ex);
    });
  }
 }else if(tables[i] === 'timings'){
    
}else if(tables[i] === 'divisions'){
  if(cell[j].Division){
    insertData = `INSERT INTO ${tables[i]} (name) SELECT * FROM (SELECT '${cell[j].Division}') AS tmp 
    WHERE NOT EXISTS (SELECT NAME FROM ${tables[i]} WHERE name = '${cell[j].Division}') LIMIT 1`;
  con.query(insertData, (err) => {
  if(err) console.log(err);
  })
  }
 }else{
   insertData = `INSERT INTO ${tables[i]} (name) SELECT * FROM (SELECT '${cell[j].Name}') AS tmp 
                WHERE NOT EXISTS (SELECT NAME FROM ${tables[i]} WHERE name = '${cell[j].Name}') LIMIT 1`;
   con.query(insertData, (err) => {
     if(err) console.log(err);
   })
 }
}
}

finalData.forEach((data, index, arr) => {
  insertData = `INSERT INTO timings (src_store_code, dest_store_code, no_of_days) VALUES
  ('${arr[index].src_store_code}', '${arr[index].dest_store_code}', '${arr[index].time}')`;
  insertData = `INSERT INTO timings (src_store_code, dest_store_code, no_of_days) 
  SELECT * FROM (SELECT '${arr[index].src_store_code}', '${arr[index].dest_store_code}', '${arr[index].time}') 
  AS tmp WHERE NOT EXISTS 
  (SELECT src_store_code, dest_store_code FROM timings WHERE src_store_code = '${arr[index].src_store_code}' AND dest_store_code = '${arr[index].dest_store_code}') LIMIT 1`;
  con.query(insertData, (err) => {
     if(err) console.log(err);
   })
})
